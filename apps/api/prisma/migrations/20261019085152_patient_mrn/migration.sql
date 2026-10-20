BEGIN;

CREATE SEQUENCE "larqon_patient_mrn_seq"
AS BIGINT
START WITH 1
INCREMENT BY 1
NO CYCLE;

CREATE FUNCTION larqon_next_patient_mrn()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  number_text TEXT;
BEGIN
  number_text :=
    nextval('larqon_patient_mrn_seq'::regclass)::TEXT;

  RETURN 'LAR-' || lpad(
    number_text,
    GREATEST(6, length(number_text)),
    '0'
  );
END;
$$;

ALTER TABLE "Patient"
ADD COLUMN "mrn" VARCHAR(30);

ALTER TABLE "Patient"
ALTER COLUMN "mrn"
SET DEFAULT larqon_next_patient_mrn();

UPDATE "Patient"
SET "mrn" = larqon_next_patient_mrn()
WHERE "mrn" IS NULL;

ALTER TABLE "Patient"
ALTER COLUMN "mrn" SET NOT NULL;

CREATE UNIQUE INDEX "Patient_mrn_key"
ON "Patient"("mrn");

COMMIT;