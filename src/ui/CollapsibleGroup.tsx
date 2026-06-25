import { ReactNode, useState } from 'react';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Összecsukható oldalpanel-csoport (akkordeon). */
export function CollapsibleGroup({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cgroup">
      <button className="cgroup-head" onClick={() => setOpen((o) => !o)}>
        <span className={'chev' + (open ? ' open' : '')}>▶</span>
        {title}
      </button>
      {open && <div className="cgroup-body">{children}</div>}
    </div>
  );
}
