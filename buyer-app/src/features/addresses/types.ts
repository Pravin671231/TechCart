// Mirrors backend's AddressRecord (addresses.repository.ts, SRS v0.5 §2.1) —
// _id/timestamps come through as strings over the wire, unlike Mongoose's
// ObjectId/Date on the backend side.

export type Address = {
  _id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type AddressInput = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};
