import { useParams } from "react-router-dom";
import ContactList from "../components/ContactList";

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  return <ContactList accountId={accountId} />;
}
