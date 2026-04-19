import { useAuth } from '../contexts/AuthContext';
import { StackWorkspace } from '../components/StackWorkspace';

export default function StacksPage() {
  const { token } = useAuth();

  return <StackWorkspace mode="authenticated" token={token} />;
}
