export function sameOrigin(request:Request){
  const origin=request.headers.get('origin');if(!origin)return false;
  try {
    const incoming=new URL(origin),expected=new URL(request.url);
    if(incoming.origin===expected.origin)return true;
    // Next puede usar una URL interna; Host conserva el destino real del navegador.
    const host=request.headers.get('host');
    if(host && incoming.host===host && ['https:','http:'].includes(incoming.protocol))return true;
    if(process.env.VERCEL || process.env.CODESPACES==='true'){
      const forwardedHost=(request.headers.get('x-forwarded-host') || '').split(',')[0].trim();
      const protocol=(request.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
      return incoming.host===forwardedHost && incoming.protocol===protocol+':';
    }
    return false;
  }catch{return false;}
}
