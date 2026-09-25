'use client';

import { useEffect, useState } from 'react';
import { INTEL_GAPS } from '@/lib/missions';

interface IntelPanelProps {
  intel: Record<string, string>;
  onSave: (gapId: string, clarification: string) => void;
}

export default function IntelPanel({ intel, onSave }: IntelPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts({ ...intel });
  }, [intel]);

  return (
    <div>
      <p className="panel-sub" style={{ marginTop: 0 }}>
        Unresolved intel from your notes. The game never guesses what these mean.
        Add your own clarification when you know it.
      </p>
      {INTEL_GAPS.map((gap) => {
        const saved = (intel[gap.id] ?? '').trim();
        const draft = drafts[gap.id] ?? '';
        const dirty = draft.trim() !== saved;
        return (
          <div key={gap.id} className="intel-card">
            <span className="intel-status">
              {saved ? 'Clarified by you' : 'Unresolved intel'}
            </span>
            <div className="intel-note">{gap.note}</div>
            <div className="intel-context">{gap.context}</div>
            <textarea
              className="intel-input"
              value={draft}
              placeholder="Your clarification..."
              onChange={(e) => setDrafts((d) => ({ ...d, [gap.id]: e.target.value }))}
              aria-label={`Clarification for: ${gap.note}`}
            />
            <button
              className="btn btn-ghost btn-small intel-save"
              disabled={!dirty}
              onClick={() => onSave(gap.id, draft.trim())}
            >
              Save clarification
            </button>
          </div>
        );
      })}
    </div>
  );
}
