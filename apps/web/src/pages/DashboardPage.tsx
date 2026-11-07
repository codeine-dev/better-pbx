import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export function DashboardPage() {
  const exts = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const trunks = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const routes = useQuery({ queryKey: ['outbound-routes'], queryFn: api.outboundRoutes });
  const inb = useQuery({ queryKey: ['inbound-routes'], queryFn: api.inboundRoutes });
  const rgs = useQuery({ queryKey: ['ring-groups'], queryFn: api.ringGroups });
  const ivrs = useQuery({ queryKey: ['ivrs'], queryFn: api.ivrs });
  const prompts = useQuery({ queryKey: ['prompts'], queryFn: api.prompts });

  const cards = [
    { label: 'Extensions', value: exts.data?.length ?? 0, to: '/extensions' },
    { label: 'Trunks', value: trunks.data?.length ?? 0, to: '/trunks' },
    { label: 'Outbound routes', value: routes.data?.length ?? 0, to: '/outbound-routes' },
    { label: 'Inbound routes', value: inb.data?.length ?? 0, to: '/inbound-routes' },
    { label: 'Ring groups', value: rgs.data?.length ?? 0, to: '/ring-groups' },
    { label: 'IVRs', value: ivrs.data?.length ?? 0, to: '/ivrs' },
    { label: 'Prompts', value: prompts.data?.length ?? 0, to: '/prompts' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid-cards">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="card card-body block hover:border-[var(--accent)]">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold">{c.value}</div>
          </Link>
        ))}
      </div>
      <div className="card card-body text-sm text-[var(--muted)]">
        Configure the PBX using the sidebar. All changes are validated, applied, and snapshotted.
      </div>
    </div>
  );
}
