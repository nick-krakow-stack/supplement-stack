import { useEffect, useState } from 'react';
import { createFamilyMember, deleteFamilyMember, getFamilyMembers } from '../api/family';
import { getStacks } from '../api/stacks';
import type { FamilyMember, Stack } from '../types';

const FAMILY_MAIN_STACKS_KEY = 'ss_family_main_stacks';

function loadMainStacks(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAMILY_MAIN_STACKS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string[]> : {};
  } catch {
    return {};
  }
}

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [mainStacks, setMainStacks] = useState<Record<string, string[]>>(loadMainStacks);
  const [draftName, setDraftName] = useState('');
  const [draftAge, setDraftAge] = useState('');
  const [draftWeight, setDraftWeight] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFamilyMembers(), getStacks()])
      .then(([loadedMembers, loadedStacks]) => {
        if (cancelled) return;
        setMembers(loadedMembers);
        setStacks(loadedStacks.stacks ?? []);
      })
      .catch(() => {
        if (!cancelled) setStatus('Familienverwaltung konnte nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FAMILY_MAIN_STACKS_KEY, JSON.stringify(mainStacks));
  }, [mainStacks]);

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    const firstName = draftName.trim();
    if (!firstName) {
      setStatus('Bitte gib einen Vornamen ein.');
      return;
    }
    const age = draftAge.trim() ? Number(draftAge) : null;
    const weight = draftWeight.trim() ? Number(draftWeight) : null;
    try {
      const member = await createFamilyMember({ first_name: firstName, age, weight });
      setMembers((prev) => [...prev, member]);
      setDraftName('');
      setDraftAge('');
      setDraftWeight('');
      setStatus('Profil angelegt.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Profil konnte nicht gespeichert werden.');
    }
  };

  const removeMember = async (member: FamilyMember) => {
    if (!window.confirm(`Profil "${member.first_name}" entfernen?`)) return;
    try {
      await deleteFamilyMember(member.id);
      setMembers((prev) => prev.filter((item) => item.id !== member.id));
      setMainStacks((prev) => {
        const next = { ...prev };
        delete next[String(member.id)];
        return next;
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Profil konnte nicht entfernt werden.');
    }
  };

  const toggleMainStack = (memberId: number, stackId: number) => {
    const key = String(memberId);
    const value = String(stackId);
    setMainStacks((prev) => {
      const current = new Set(prev[key] ?? []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      return { ...prev, [key]: [...current] };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-950">Familie verwalten</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Familienmitglieder anlegen und Haupt-Stacks fuer die gemeinsame Uebersicht markieren.
        </p>
      </div>

      <form onSubmit={addMember} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_120px_140px_auto]">
        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Vorname" />
        <input value={draftAge} onChange={(event) => setDraftAge(event.target.value)} inputMode="numeric" placeholder="Alter" />
        <input value={draftWeight} onChange={(event) => setDraftWeight(event.target.value)} inputMode="decimal" placeholder="Gewicht" />
        <button type="submit">Profil hinzufuegen</button>
      </form>

      {status && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">{status}</div>}

      {loading ? (
        <div className="text-sm font-semibold text-slate-500">Laden...</div>
      ) : (
        <div className="grid gap-4">
          {members.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm font-semibold text-slate-500">
              Noch keine Familienmitglieder angelegt.
            </div>
          )}
          {members.map((member) => {
            const memberStacks = stacks.filter((stack) => stack.family_member_id === member.id);
            const selected = new Set(mainStacks[String(member.id)] ?? []);
            return (
              <section key={member.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">{member.first_name}</h2>
                    <p className="text-sm font-semibold text-slate-500">
                      {[member.age != null ? `${member.age} Jahre` : null, member.weight != null ? `${member.weight} kg` : null].filter(Boolean).join(' - ') || 'Keine Details'}
                    </p>
                  </div>
                  <button type="button" className="bg-red-50 text-red-700 hover:bg-red-100" onClick={() => void removeMember(member)}>
                    Entfernen
                  </button>
                </div>
                <div className="mt-4 grid gap-2">
                  {memberStacks.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500">Keine Stacks zugeordnet.</p>
                  ) : (
                    memberStacks.map((stack) => (
                      <label key={stack.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={selected.has(String(stack.id))}
                          onChange={() => toggleMainStack(member.id, stack.id)}
                        />
                        {stack.name}
                      </label>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
