import axios from "axios";

export default function LogoutButton() {
    return (
        <button
            onClick={async () => {
                await axios.post("http://localhost:4000/auth/logout", {}, { withCredentials: true });
                window.location.reload();
            }}>
            Sign Out
        </button>
    );
}
