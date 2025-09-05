import './styles.css';
import ArcheroGame from './ArcheroGame';

export default function App() {
  return (
    <main className="container">
      {/* Use the high-resolution Factory logo */}
      {/* Use the authentic Factory star logo */}
      {/* Display official favicon logo from live Factory app */}
      {/* Display authentic Factory SVG logo */}
      <img src="/assets/logo.png" alt="Factory logo" width={128} />
      {/* Display the Factory wordmark */}
      <img
        src="/assets/wordmark.png"
        alt="Factory wordmark"
        width={320}
        className="wordmark"
      />
      <ArcheroGame />
    </main>
  );
}
