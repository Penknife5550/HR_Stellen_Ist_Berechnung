ALTER TABLE "mehrarbeit" ADD CONSTRAINT "mehrarbeit_variante_check" CHECK ((
    (lehrer_id IS NOT NULL AND schule_id IS NOT NULL AND stellenanteil IS NULL)
    OR
    (lehrer_id IS NULL AND schule_id IS NOT NULL AND stellenanteil IS NOT NULL AND stunden = 0)
  ));