export default function LogoutButton() {
    return (
        <button
            onClick={() => {
                window.location.href = "http://localhost:4000/auth/logout";
            }}>
            Sign Out
        </button>
    );
}
