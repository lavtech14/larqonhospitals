import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from 'livekit-server-sdk';

import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';

const JOIN_EARLY_MS = 10 * 60_000;
const TOKEN_TTL_SECONDS = 5 * 60;

const consultationFields = {
  id: true,
  startsAt: true,
  endsAt: true,
  mode: true,
  status: true,
  consultationEndedAt: true,
  consultationRoomClosedAt: true,
} satisfies Prisma.AppointmentSelect;

type ConsultationAppointment = Prisma.AppointmentGetPayload<{
  select: typeof consultationFields;
}>;

type Actor = {
  role: 'doctor' | 'patient';
  id: string;
};

@Injectable()
export class ConsultationsService {
  constructor(private readonly database: DatabaseService) {}

  joinAsDoctor(staffUserId: string, appointmentId: string) {
    return this.join({ role: 'doctor', id: staffUserId }, appointmentId);
  }

  joinAsPatient(accountId: string, appointmentId: string) {
    return this.join({ role: 'patient', id: accountId }, appointmentId);
  }

  statusAsDoctor(staffUserId: string, appointmentId: string) {
    return this.getStatus({ role: 'doctor', id: staffUserId }, appointmentId);
  }

  statusAsPatient(accountId: string, appointmentId: string) {
    return this.getStatus({ role: 'patient', id: accountId }, appointmentId);
  }

  private settings() {
    const serverUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (
      process.env.LIVEKIT_ENABLED !== 'true' ||
      !serverUrl ||
      !apiKey ||
      !apiSecret
    ) {
      throw new ServiceUnavailableException(
        'Online consultations are currently unavailable.',
      );
    }

    if (
      process.env.NODE_ENV === 'production' &&
      !serverUrl.startsWith('wss://')
    ) {
      throw new ServiceUnavailableException(
        'Online consultations require a secure server connection.',
      );
    }

    return { serverUrl, apiKey, apiSecret };
  }

  private roomName(appointmentId: string) {
    return `consultation-${appointmentId}`;
  }

  private async authorizedAppointment(
    tx: Prisma.TransactionClient,
    actor: Actor,
    appointmentId: string,
  ) {
    const appointment = await tx.appointment.findFirst({
      where: {
        id: appointmentId,
        doctor: {
          isActive: true,
          department: { isActive: true },
          ...(actor.role === 'doctor' ? { staffUserId: actor.id } : {}),
        },
        ...(actor.role === 'patient'
          ? {
              patient: {
                account: {
                  id: actor.id,
                  isActive: true,
                  mustChangePassword: false,
                },
              },
            }
          : {}),
      },
      select: consultationFields,
    });

    if (!appointment) {
      throw new NotFoundException('Appointment is unavailable.');
    }

    return appointment;
  }

  // Join and end use the same per-appointment transaction lock.
  private async lock(tx: Prisma.TransactionClient, appointmentId: string) {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${'consultation:' + appointmentId}, 0)
      )::text AS "lockResult"
    `;
  }

  private async getStatus(actor: Actor, appointmentId: string) {
    return this.database.$transaction(async (tx) => {
      const appointment = await this.authorizedAppointment(
        tx,
        actor,
        appointmentId,
      );

      return this.statusResponse(appointment);
    });
  }

  private statusResponse(appointment: ConsultationAppointment) {
    return {
      appointmentId: appointment.id,
      endedAt: appointment.consultationEndedAt,
      roomClosurePending: Boolean(
        appointment.consultationEndedAt &&
        !appointment.consultationRoomClosedAt,
      ),
    };
  }

  private async join(actor: Actor, appointmentId: string) {
    return this.database.$transaction(async (tx) => {
      await this.lock(tx, appointmentId);

      const appointment = await this.authorizedAppointment(
        tx,
        actor,
        appointmentId,
      );

      if (appointment.consultationEndedAt) {
        throw new ForbiddenException('This consultation has been completed.');
      }

      if (appointment.mode !== 'ONLINE') {
        throw new BadRequestException(
          'Video consultation is available only for online appointments.',
        );
      }

      if (appointment.status !== 'BOOKED') {
        throw new BadRequestException(
          'This appointment is unavailable for consultation.',
        );
      }

      const now = Date.now();
      const opensAt = appointment.startsAt.getTime() - JOIN_EARLY_MS;
      const remainingSeconds = Math.floor(
        (appointment.endsAt.getTime() - now) / 1000,
      );

      if (now < opensAt) {
        throw new ForbiddenException(
          'Joining opens 10 minutes before the appointment.',
        );
      }

      if (remainingSeconds < 1) {
        throw new ForbiddenException(
          'The consultation joining window has ended.',
        );
      }

      const { serverUrl, apiKey, apiSecret } = this.settings();
      const ttl = Math.min(TOKEN_TTL_SECONDS, remainingSeconds);
      const roomName = this.roomName(appointment.id);
      const participantIdentity = `${actor.role}-${actor.id}`;

      const accessToken = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
        name: actor.role === 'doctor' ? 'Doctor' : 'Patient',
        ttl,
      });

      accessToken.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
        canSubscribe: true,
        canPublishData: false,
        canUpdateOwnMetadata: false,
      });

      return {
        appointmentId: appointment.id,
        serverUrl,
        roomName,
        participantIdentity,
        role: actor.role,
        token: await accessToken.toJwt(),
        tokenExpiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        joinWindowEndsAt: appointment.endsAt.toISOString(),
      };
    });
  }

  async endAsDoctor(staffUserId: string, appointmentId: string) {
    // Check configuration before recording completion.
    const settings = this.settings();

    const appointment = await this.database.$transaction(async (tx) => {
      await this.lock(tx, appointmentId);

      const current = await this.authorizedAppointment(
        tx,
        { role: 'doctor', id: staffUserId },
        appointmentId,
      );

      // Repeated requests retry cleanup without recording completion twice.
      if (current.consultationEndedAt) {
        return current;
      }

      if (current.mode !== 'ONLINE' || current.status !== 'BOOKED') {
        throw new BadRequestException(
          'Only a booked online consultation can be completed.',
        );
      }

      if (Date.now() < current.startsAt.getTime() - JOIN_EARLY_MS) {
        throw new ForbiddenException(
          'The consultation joining window has not opened.',
        );
      }

      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          consultationEndedAt: new Date(),
          version: { increment: 1 },
        },
        select: consultationFields,
      });

      await tx.auditEvent.create({
        data: {
          actorStaffId: staffUserId,
          action: 'consultation.completed',
          resourceType: 'Appointment',
          resourceId: appointmentId,
        },
      });

      return updated;
    });

    if (appointment.consultationRoomClosedAt) {
      return this.statusResponse(appointment);
    }

    // Perform the network call after committing the database transaction.
    const httpUrl = settings.serverUrl
      .replace(/^wss:/, 'https:')
      .replace(/^ws:/, 'http:');

    const rooms = new RoomServiceClient(
      httpUrl,
      settings.apiKey,
      settings.apiSecret,
    );

    try {
      await rooms.deleteRoom(this.roomName(appointmentId));
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught !== null && 'code' in caught
          ? caught.code
          : undefined;

      // An already absent room is also a successful cleanup.
      if (code !== 'not_found') {
        return {
          appointmentId,
          endedAt: appointment.consultationEndedAt,
          roomClosurePending: true,
        };
      }
    }

    const updated = await this.database.appointment.update({
      where: { id: appointmentId },
      data: {
        consultationRoomClosedAt: new Date(),
      },
      select: consultationFields,
    });

    return this.statusResponse(updated);
  }
}
