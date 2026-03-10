import type { Db, ObjectId } from "mongodb";
import { ObjectId as MongoObjectId } from "mongodb";

export type VehicleDoc = {
  _id: ObjectId;
  userId: ObjectId;
  vin: string;
  make: string;
  model: string;
  year: number;
  batteryCapacityKwh: number;
  maxChargePowerKw: number;
  connectorTypes: string[];
  createdAt: Date;
};

export async function findVehiclesByUserId(
  database: Db,
  userId: string
): Promise<VehicleDoc[]> {
  return database
    .collection<VehicleDoc>("vehicles")
    .find({ userId: new MongoObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
}
