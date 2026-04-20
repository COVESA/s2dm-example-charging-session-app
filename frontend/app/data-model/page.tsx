import { DataModelExplorer } from "./_components/DataModelExplorer";

export const metadata = {
  title: "Data Model Explorer — LeafyCharge",
  description:
    "From conceptual S2DM model to application and database: the story behind this EV charging demo."
};

export default function DataModelPage() {
  return <DataModelExplorer />;
}
