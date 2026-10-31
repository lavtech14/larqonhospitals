// A later rejection cannot prove that a previously unconfirmed request never committed.
export function mayDiscardFailedPharmacyRequest(
  wasUncertain: boolean,
  status: number | undefined,
): boolean {
  return (
    !wasUncertain &&
    status !== undefined &&
    [400, 403, 404, 409, 422].includes(status)
  );
}
