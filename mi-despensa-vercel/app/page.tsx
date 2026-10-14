import Pantry from './pantry';
import { requireSession } from '../lib/auth';
export const dynamic = 'force-dynamic';
export default async function Home() { await requireSession(); return <Pantry/>; }
