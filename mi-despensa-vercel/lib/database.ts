type RpcValue = Record<string,unknown>;
export class DatabaseError extends Error {}
export function household(){return process.env.DESPENSA_ID || 'casa';}
export async function rpc<T>(name:string,parameters:RpcValue):Promise<T>{
  const rawUrl=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
  if(!rawUrl || !key)throw new DatabaseError('Completa la conexión de la despensa.');
  const base=new URL(rawUrl);
  if(base.protocol!=='https:')throw new DatabaseError('La conexión debe usar HTTPS.');
  const headers:Record<string,string>={'Content-Type':'application/json',apikey:key};
  // Las claves sb_secret_ se envían solo en apikey; las antiguas service_role son JWT.
  if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
  let response:Response;
  try{response=await fetch(new URL('/rest/v1/rpc/'+name,base),{method:'POST',headers,body:JSON.stringify(parameters),cache:'no-store',signal:AbortSignal.timeout(15000)});}
  catch{throw new DatabaseError('No se pudo conectar con la despensa.');}
  if(!response.ok)throw new DatabaseError('No se pudo guardar o cargar la despensa. Revisa la conexión.');
  return await response.json() as T;
}
