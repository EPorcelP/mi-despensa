import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from '../../../../lib/admin-access';
import { sameOrigin } from '../../../../lib/origin';
export async function POST(request:Request) {
  if (!sameOrigin(request)) return Response.json({error:'Petición no permitida'},{status:403});
  (await cookies()).delete(ADMIN_COOKIE);
  return Response.json({ok:true});
}
