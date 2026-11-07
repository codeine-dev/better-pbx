import { useQuery } from '@tanstack/react-query';
import type { Destination } from '@better-pbx/shared';
import { api } from '../lib/api';

export function DestinationPicker({
  value,
  onChange,
}: {
  value: Destination;
  onChange: (d: Destination) => void;
}) {
  const exts = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const rgs = useQuery({ queryKey: ['ring-groups'], queryFn: api.ringGroups });
  const ivrs = useQuery({ queryKey: ['ivrs'], queryFn: api.ivrs });

  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="select"
        value={value.type}
        onChange={(e) => {
          const t = e.target.value;
          if (t === 'hangup') onChange({ type: 'hangup' });
          if (t === 'extension') onChange({ type: 'extension', extensionId: exts.data?.[0]?.id ?? '' });
          if (t === 'ringGroup') onChange({ type: 'ringGroup', ringGroupId: rgs.data?.[0]?.id ?? '' });
          if (t === 'ivr') onChange({ type: 'ivr', ivrId: ivrs.data?.[0]?.id ?? '' });
          if (t === 'voicemail') onChange({ type: 'voicemail', extensionId: exts.data?.[0]?.id ?? '' });
        }}
      >
        <option value="hangup">Hang up</option>
        <option value="extension">Extension</option>
        <option value="ringGroup">Ring group</option>
        <option value="ivr">IVR</option>
        <option value="voicemail">Voicemail</option>
      </select>
      {value.type === 'extension' && (
        <select className="select" value={value.extensionId} onChange={(e) => onChange({ type: 'extension', extensionId: e.target.value })}>
          {(exts.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.number} — {e.displayName}</option>)}
        </select>
      )}
      {value.type === 'ringGroup' && (
        <select className="select" value={value.ringGroupId} onChange={(e) => onChange({ type: 'ringGroup', ringGroupId: e.target.value })}>
          {(rgs.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.number} — {r.name}</option>)}
        </select>
      )}
      {value.type === 'ivr' && (
        <select className="select" value={value.ivrId} onChange={(e) => onChange({ type: 'ivr', ivrId: e.target.value })}>
          {(ivrs.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      )}
      {value.type === 'voicemail' && (
        <select className="select" value={value.extensionId} onChange={(e) => onChange({ type: 'voicemail', extensionId: e.target.value })}>
          {(exts.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.number} — {e.displayName}</option>)}
        </select>
      )}
    </div>
  );
}
