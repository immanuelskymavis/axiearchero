import './styles.css';
import bgUrl from '../assets/axie background.jpg';
import ArcheroGame from './ArcheroGame';

export default function App() {
  return (
    <main
      className="container"
      style={{ background: `url(${bgUrl}) center / cover fixed no-repeat` }}
    >
      <ArcheroGame />
    </main>
  );
}
