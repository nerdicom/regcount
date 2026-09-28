'use client';
import type { ResearchOptions } from '@/lib/domains';
export type AdvancedFields={sort:ResearchOptions['sort'];min:string;max:string;tlds:string;exclude:string;omit:string[]};
export const emptyAdvanced:AdvancedFields={sort:'name',min:'',max:'',tlds:'',exclude:'',omit:[]};
export function AdvancedSearch({available=true,enabled,fields,onToggle,onChange}:{available?:boolean;enabled:boolean;fields:AdvancedFields;onToggle:(value:boolean)=>void;onChange:(value:AdvancedFields)=>void}) {
  const patch=(change:Partial<AdvancedFields>)=>onChange({...fields,...change});
  return <div className="advanced-search">
    <button type="button" className="advanced-toggle" disabled={!available} aria-expanded={available&&enabled} aria-controls="advanced-options" aria-describedby={!available?'advanced-unavailable':undefined} onClick={()=>onToggle(!enabled)}>{enabled?'−':'+'} Advanced search</button>
    {!available&&<span id="advanced-unavailable" className="advanced-unavailable">Advanced filters are currently unavailable.</span>}
    {available&&enabled&&<div id="advanced-options" className="advanced-options">
      <p className="advanced-hint">Combine words with spaces, such as <strong>new york tours</strong>. Words match in the order entered. Filters apply to counts and related names.</p>
      <div className="advanced-fields">
        <label>Sort all matching names<select value={fields.sort} onChange={e=>patch({sort:e.target.value as AdvancedFields['sort']})}><option value="name">Name A–Z</option><option value="count_desc">Most extensions first</option><option value="count_asc">Fewest extensions first</option></select></label>
        <label>Include extensions<input value={fields.tlds} onChange={e=>patch({tlds:e.target.value})} placeholder="e.g. org, dev, app" maxLength={256}/></label>
        <label>Exclude words<input value={fields.exclude} onChange={e=>patch({exclude:e.target.value})} placeholder="e.g. shop, free" maxLength={200}/></label>
        <div className="length-inputs"><label>Min. length<input type="number" min="1" max="63" value={fields.min} onChange={e=>patch({min:e.target.value})} placeholder="1"/></label><label>Max. length<input type="number" min="1" max="63" value={fields.max} onChange={e=>patch({max:e.target.value})} placeholder="63"/></label></div>
      </div>
      <div className="advanced-actions"><fieldset><legend>Hide names containing</legend>{[['digits','Numbers'],['hyphens','Hyphens'],['idns','IDNs (xn--)']].map(([value,label])=><label key={value}><input type="checkbox" checked={fields.omit.includes(value)} onChange={e=>patch({omit:e.target.checked?[...fields.omit,value]:fields.omit.filter(v=>v!==value)})}/>{label}</label>)}</fieldset><button type="button" onClick={()=>onChange(emptyAdvanced)}>Reset filters</button><button type="submit" form="domain-search-form" className="primary-button">Apply & search</button></div>
    </div>}
  </div>;
}
