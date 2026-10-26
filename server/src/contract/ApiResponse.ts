/** Every endpoint's JSON body. In M5 this moves to shared/ so the client uses the same type. */
export interface ApiResponse<T> {
  asOf: string;  // when the server got this data (ISO 8601 time)
  etag: string;  // a fingerprint of the data
  data: T;       // the data itself
}
