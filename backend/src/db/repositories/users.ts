import type { Db } from "mongodb";
import type { ObjectId } from "mongodb";

export type UserDoc = {
  _id: ObjectId;
  email: string;
  displayName: string;
  roles: string[];
};

export type UserForList = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

export async function findUsers(database: Db): Promise<UserForList[]> {
  const cursor = database.collection<UserDoc>("users").find({});
  const docs = await cursor.toArray();
  return docs.map((doc) => ({
    id: String(doc._id),
    email: doc.email,
    displayName: doc.displayName,
    roles: doc.roles ?? []
  }));
}
