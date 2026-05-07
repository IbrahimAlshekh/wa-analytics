import { jsx as _jsx } from "react/jsx-runtime";
import { useParams } from "react-router-dom";
import ContactList from "../components/ContactList";
export default function Dashboard() {
    const { id } = useParams();
    const accountId = Number(id);
    return _jsx(ContactList, { accountId: accountId });
}
