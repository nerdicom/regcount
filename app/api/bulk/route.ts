import {dataMode,searchRegistrations} from '@/lib/registration-provider';
import {normalizeQuery,type BulkRow} from '@/lib/domains';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'This request must come from RegCount.'},{status:403});
 const text=await request.text();if(text.length>20000)return Response.json({error:'The list is too large.'},{status:413});
 let payload;try{payload=JSON.parse(text);}catch{return Response.json({error:'Send a valid list of names.'},{status:400});}
 if(!Array.isArray(payload?.queries)||!payload.queries.length||payload.queries.length>50||payload.queries.some((q:unknown)=>typeof q!=='string'))return Response.json({error:'Provide between 1 and 50 names.'},{status:400});
 const source=dataMode(),results:BulkRow[]=[],queries:string[]=[],seen=new Set<string>();
 for(const value of payload.queries as string[]){try{const query=normalizeQuery(value);if(!seen.has(query)){seen.add(query);queries.push(query);}}catch(error){if(!seen.has(value)){seen.add(value);results.push({query:value.slice(0,253),total:null,source,suffixes:[],error:error instanceof Error?error.message:'Invalid name'});}}}
 for(let i=0;i<queries.length;i+=3){const batch=await Promise.all(queries.slice(i,i+3).map(async (query): Promise<BulkRow> =>{try{const result=await searchRegistrations(query);return {query,total:result.total,source:result.source,suffixes:result.suffixes,...(result.total===null?{error:'No sample data for this name'}:{})};}catch(error){return {query,total:null,source,suffixes:[],error:error instanceof Error?error.message:'Search failed'};}}));results.push(...batch);}
 return Response.json({source,results},{headers:{'Cache-Control':'private, no-store'}});
}
