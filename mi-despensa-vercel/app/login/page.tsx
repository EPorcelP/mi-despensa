import { redirect } from 'next/navigation';
import { hasSession } from '../../lib/auth';
import Login from './login';
export const dynamic='force-dynamic';
export default async function LoginPage(){if(await hasSession())redirect('/');return <Login/>;}
