// Mismo proyecto Firebase que KRONOS (kronos-7ebd7), pero con su propia base
// de datos Firestore nombrada (Firestore admite multiples DBs por proyecto).
// No usar "(default)" — este sistema vive aislado en esta base.
export const FIRESTORE_DATABASE_ID = "epl-tickets";

// Idem para Storage: mismo proyecto, pero bucket propio (no el default del
// proyecto, que usa KRONOS). Los documentos adjuntos de los tickets viven aqui.
export const STORAGE_BUCKET = "tickets-epl-legal";
