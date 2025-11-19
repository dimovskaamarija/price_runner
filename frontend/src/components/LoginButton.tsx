export default function LoginButton() {
    return (
        <button onClick={() => window.location.href = "http://localhost:4000/auth/login"}>
            Sign In / Sign Up
        </button>
    );
}
