import React, { useMemo, useEffect, useState, useRef } from 'react';
import characters from './data/characters.json';
import importedStatistics from './data/playerStatistics.json';
import statisticDefinitions from './data/statisticDefinitions.json';
import { createClient } from '@supabase/supabase-js';

// Load mugshot images (Vite)
const MUGSHOTS = import.meta.glob('../images/*mugshot.png', { eager: true, as: 'url' });

const IMAGE_MAP = {
  "luigi": "luigimugshot.png",
  "mario": "mariomugshot.png",
  "peach": "peachmugshot.png",
  "daisy": "daisymugshot.png",
  "yoshi": "yoshimugshot.png",
  "toad": "toadmugshot.png",
  "dk": "dkmugshot.png",
  "gkoopa": "koopamugshot.png",
  "rkoopa": "koopamugshot.png",
  "bkoopa": "bkoopamugshot.png",
  "gpara": "paratroopamugshot.png",
  "rpara": "paratroopamugshot.png",
  "graybones": "drybonesmugshot.png",
  "gdry": "drybonesmugshot.png",
  "rdry": "darkbonesmugshot.png",
  "bdry": "drybonesmugshot.png",
  "hammer": "bromugshot.png",
  "fire": "bromugshot.png",
  "boomerang": "bromugshot.png",
  "rmm": "malemiimugshot.png",
  "rmf": "femalemiimugshot.png",
  "omm": "malemiimugshot.png",
  "omf": "femalemiimugshot.png",
  "ymm": "malemiimugshot.png",
  "ymf": "femalemiimugshot.png",
  "lgmm": "malemiimugshot.png",
  "lgmf": "femalemiimugshot.png",
  "gmm": "malemiimugshot.png",
  "gmf": "femalemiimugshot.png",
  "bmm": "malemiimugshot.png",
  "bmf": "femalemiimugshot.png",
  "lbmm": "malemiimugshot.png",
  "lbmf": "femalemiimugshot.png",
  "pmm": "malemiimugshot.png",
  "pmf": "femalemiimugshot.png",
  "pumm": "malemiimugshot.png",
  "pumf": "femalemiimugshot.png",
  "brmm": "malemiimugshot.png",
  "brmf": "femalemiimugshot.png",
  "wmm": "malemiimugshot.png",
  "wmf": "femalemiimugshot.png",
  "blmm": "malemiimugshot.png",
  "blmf": "femalemiimugshot.png",
};

const TABS = ['Players', 'Chemistry', 'Outfield', 'Draft', 'Draft Board', 'Rosters'];
const statGroups = {
  Batting: ['Slap Contact', 'Charge Contact', 'Slap Power', 'Charge Power', 'Bunting'],
  Pitching: ['Fastball Speed', 'Curveball Speed', 'Curve', 'Stamina'],
  Fielding: ['Fielding Throw Speed', 'Speed', 'Fielding', 'Weight']
};
const familyAliases = {
  'yoshis': ['yoshi'], 'toads': ['toad'], 'piantas': ['pianta'], 'kritters': ['kritter'],
  'nokis': ['noki'], 'shy guys': ['shy guy'], 'shyguys': ['shy guy'],
  'bros': ['bro'], 'paratroopas': ['paratroopa'], 'koopas': ['koopa'],
  'magikoopas': ['magikoopa'], 'dry bones': ['dry'], 'drybones': ['dry bones']
};
const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const familyKey = s => {
  const key = s.toLowerCase().trim();
  if (familyAliases[key]) return familyAliases[key][0];
  return key;
};
function chemistryMatches(entry, target) {
  if (slug(entry) === slug(target.name)) return true;
  if (slug(target.name).includes("black") && !slug(target.name).includes("mii")) return false;
  const e = familyKey(entry);
  const n = familyKey(target.name);
  if (e === n) return true;
  const eWords = e.split(/[\s()]+/).filter(Boolean);
  const nWords = n.split(/[\s()]+/).filter(Boolean);
  if (eWords.length === 1 && nWords.some(w => w === eWords[0] || w === eWords[0].replace(/s$/, ''))) return true;
  return false;
}
function hasGoodChemistry(center, wing) {
  return (center?.goodChemistry || []).some(entry => chemistryMatches(entry, wing));
}

function hasSuperDive(player) {
  return Boolean(player?.superDive || /super\s*dive/i.test(player?.ability || ''));
}
function fieldScore(c) {
  const s = c.stats || {};
  const dive = hasSuperDive(c) ? 8 : 0;
  return ((s['Fielding Throw Speed'] ?? 0) / 90 * 25)
    + ((s.Speed ?? 0) / 90 * 35)
    + ((s.Fielding ?? 0) / 100 * 32) + dive;
}
function tierFor(score) {
  if (score >= 82) return { label: 'S', name: 'Elite', cls: 'tier-s' };
  if (score >= 72) return { label: 'A', name: 'Strong', cls: 'tier-a' };
  if (score >= 62) return { label: 'B', name: 'Solid', cls: 'tier-b' };
  if (score >= 50) return { label: 'C', name: 'Situational', cls: 'tier-c' };
  return { label: 'D', name: 'Needs help', cls: 'tier-d' };
}
function initials(name) { return name.split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase(); }

function avatarSrcFor(player) {
  if (!player || !player.id) return null;
  if (player.image) {
    const explicit = Object.keys(MUGSHOTS).find(k => k.endsWith('/' + player.image));
    if (explicit) return MUGSHOTS[explicit];
  }
  if (IMAGE_MAP[player.id]) {
    const mapKey = Object.keys(MUGSHOTS).find(k => k.endsWith('/' + IMAGE_MAP[player.id]));
    if (mapKey) return MUGSHOTS[mapKey];
  }
  const key = Object.keys(MUGSHOTS).find(k => k.toLowerCase().includes(player.id.toLowerCase()));
  return key ? MUGSHOTS[key] : null;
}

function PlayerAvatar({ player, small = false }) {
  const src = avatarSrcFor(player);
  const cls = `avatar ${small ? 'avatar-small' : ''} class-${(player.class || 'balanced').toLowerCase()}`;
  if (src) return <div className={cls} aria-hidden="true"><img src={src} alt={player.name + ' portrait'} /></div>;
  return <div className={cls} aria-hidden="true">{initials(player.name)}</div>;
}
const HITBOX_STAT_MAX = 7;
const GAMEPLAY_SCALE_MAX = 2;
function StatBar({ label, value, max, maxLabel, formatValue, compact = false }) {
  const valid = typeof value === 'number' && Number.isFinite(value);
  const shownValue = valid ? (formatValue ? formatValue(value) : value) : '—';
  const shownMax = maxLabel ?? max;
  const progress = valid && typeof max === 'number' && max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return <div className={`stat-line ${compact ? 'stat-line-compact' : ''}`}>
    <div className="stat-line-top"><span>{label}</span><b>{shownValue}<small> / {shownMax}</small></b></div>
    <div className="meter" role="img" aria-label={`${label}: ${shownValue} on a scale of ${shownMax}`}><span style={{ width: `${progress}%` }} /></div>
  </div>;
}
function getPlayerSeasonMetrics(player) {
  const values = importedStatistics?.[player?.id] || {};
  const inningsPitched = values.IP;
  const hasPitched = typeof inningsPitched === 'number' && Number.isFinite(inningsPitched) && inningsPitched > 0;
  return statisticDefinitions.filter(definition => {
    const value = values[definition.key];
    if (definition.category === 'Pitching') {
      // Only show pitching lines for players with actual innings pitched. Once
      // eligible, keep IP/ERA/WHIP visible even if one field is unavailable.
      if (!hasPitched) return false;
      if (['IP', 'ERA', 'WHIP'].includes(definition.key)) return true;
    }
    return typeof value === 'number' && Number.isFinite(value);
  }).map(definition => ({ ...definition, value: values[definition.key] }));
}
function getSortValue(player, key) {
  if (key === 'name') return player?.name ?? '';
  if (key === 'hitbox:diveRadius') return player?.hitboxes?.diveRadius;
  if (key === 'hitbox:regularCatch') return player?.hitboxes?.regularCatch;
  if (key === 'hitbox:hitboxHeight') return player?.hitboxes?.hitboxHeight;
  if (key === 'hitbox:gameplayScale') return player?.hitboxes?.gameplayScale;
  if (key.startsWith('season:')) return importedStatistics?.[player?.id]?.[key.slice('season:'.length)];
  return player?.stats?.[key];
}

function formatMetricValue(value, decimals = 3, format = 'decimal') {
  if (!Number.isFinite(value)) return '—';
  const rendered = value.toFixed(decimals);
  return format === 'decimal' && Math.abs(value) < 1 ? rendered.replace(/^(-?)0\./, '$1.') : rendered;
}
function HitboxMetrics({ player, compact = false, showTitle = true }) {
  const hitboxes = player?.hitboxes;
  return <div className={`player-hitbox-stats ${compact ? 'player-hitbox-stats-compact' : ''}`}>
    {showTitle && <div className="player-stat-section-title">Gameplay hitboxes</div>}
    <StatBar label="Dive radius" value={hitboxes?.diveRadius} max={HITBOX_STAT_MAX} maxLabel={HITBOX_STAT_MAX.toFixed(1)} formatValue={v => v.toFixed(2)} compact={compact} />
    <StatBar label="Regular catch" value={hitboxes?.regularCatch} max={HITBOX_STAT_MAX} maxLabel={HITBOX_STAT_MAX.toFixed(1)} formatValue={v => v.toFixed(2)} compact={compact} />
    <StatBar label="Hitbox height" value={hitboxes?.hitboxHeight} max={HITBOX_STAT_MAX} maxLabel={HITBOX_STAT_MAX.toFixed(1)} formatValue={v => v.toFixed(2)} compact={compact} />
    <StatBar label="Gameplay scale" value={hitboxes?.gameplayScale} max={GAMEPLAY_SCALE_MAX} maxLabel={GAMEPLAY_SCALE_MAX.toFixed(1)} formatValue={v => v.toFixed(2)} compact={compact} />
  </div>;
}
function ImportedStatistics({ player, compact = false }) {
  const metrics = getPlayerSeasonMetrics(player);
  if (!metrics.length) return null;
  const groups = metrics.reduce((result, metric) => {
    const group = metric.category || 'Other';
    (result[group] ||= []).push(metric);
    return result;
  }, {});
  return <div className={`player-imported-stats ${compact ? 'player-imported-stats-compact' : ''}`}>
    {Object.entries(groups).map(([group, groupMetrics]) => <div className="imported-stat-group" key={group}>
      {Object.keys(groups).length > 1 && <div className="imported-stat-group-label">{group}</div>}
      {groupMetrics.map(metric => <StatBar key={metric.key} label={metric.label} value={metric.value} max={metric.max} maxLabel={metric.maxLabel || metric.max} formatValue={v => formatMetricValue(v, metric.decimals ?? 3, metric.format)} compact={compact} />)}
    </div>)}
  </div>;
}

function PlayerCard({ player, onClick }) {
  const importedMetrics = getPlayerSeasonMetrics(player);
  return (
    <button className="player-card" onClick={onClick} type="button" aria-label={`View ${player.name} player profile`}>
      <div className="player-card-top">
        <PlayerAvatar player={player} />
        <div className="player-name-wrap">
          <h3>{player.name}</h3>
          <p>{player.class || 'Class unknown'} · {player.captain ? 'Captain' : 'Player'}</p>
        </div>
        <span className="arrow" aria-hidden="true">↗</span>
      </div>
      <div className="chips">
        <span className="chip ability">{player.class || 'No class listed'}</span>
        <span className="chip class">{player.ability || 'No ability listed'}</span>
        <span className="chip trajectory">{player.stats.Trajectory ? `${player.stats.Trajectory} Trajectory` : 'No trajectory listed'}</span>
        {player.stats['Hit Curve'] === 'Enabled' && <span className="chip hit-curve">Hit Curve</span>}
      </div>
    </button>
  );
}
function PlayerModal({ player, close }) {
  if (!player) return null;
  return <div className="modal-backdrop" onClick={close}><section className="player-modal" role="dialog" aria-modal="true" aria-label={`${player.name} profile`} onClick={e => e.stopPropagation()}>
    <button className="close-button" onClick={close} aria-label="Close player details">×</button>
    <div className="profile-heading"><PlayerAvatar player={player}/><div><div className="eyebrow">PLAYER PROFILE</div><h2>{player.name}</h2><p>{player.class} class · {player.captain ? 'Captain' : 'Non-captain'} · {player.ability || 'No ability listed'}</p></div></div>
    <div className="meta-grid"><div><small>Bats</small><b>{player.bats || '—'}</b></div><div><small>Throws</small><b>{player.throws || '—'}</b></div><div><small>Ability</small><b>{player.ability || '—'}</b></div></div>
    <div className="stats-grid">{Object.entries(statGroups).map(([group, labels]) => <div className="panel stat-panel" key={group}><h3>{group}</h3>{labels.map(label => <StatBar key={label} label={label} value={player.stats[label]} max={label==='Slap Contact'?80:label==='Charge Contact'?60:label==='Fastball Speed'?175:label==='Curveball Speed'?150:label==='Curve'?90:label==='Fielding Throw Speed'?90:label==='Speed'?90:label==='Weight'?4:100}/>)}
    {group==='Batting' && <div className="profile-note"><span>Trajectory <b>{player.stats.Trajectory || '—'}</b></span><span>Hit curve <b>{player.stats['Hit Curve'] || '—'}</b></span></div>}</div>)}
      <div className="panel stat-panel"><h3>Hitboxes</h3><HitboxMetrics player={player} showTitle={false}/></div>
      {getPlayerSeasonMetrics(player).length > 0 && <div className="panel stat-panel"><h3>Preseason Stats</h3><ImportedStatistics player={player}/></div>}
    </div>
    <div className="chem-columns"><div className="panel"><h3 className="good-text">＋ Good chemistry</h3><div className="tag-list">{(player.goodChemistry || []).map(x=><span className="chem-tag good" key={x}>{x}</span>)}{!player.goodChemistry?.length && <span className="muted">None listed</span>}</div></div><div className="panel"><h3 className="bad-text">− Bad chemistry</h3><div className="tag-list">{(player.badChemistry || []).map(x=><span className="chem-tag bad" key={x}>{x}</span>)}{!player.badChemistry?.length && <span className="muted">None listed</span>}</div></div></div>
  </section></div>;
}
function PlayersTab({ onSelect }) {
  const { draftState } = useSharedDraftState();
  const [draftStatus, setDraftStatus] = useState('All players');
  const draftedIds = useMemo(() => new Set(getAllRosterAssignments(draftState, characters).map(pick => String(pick.playerId))), [draftState]);
  const [query,setQuery]=useState('');
  const [klass,setKlass]=useState('All classes');
  const [ability,setAbility]=useState('All abilities');
  const [captain,setCaptain]=useState('All players');
  const [trajectory,setTrajectory]=useState('All trajectories');
  const [hitCurve,setHitCurve]=useState('All hit curves');
  const [sortBy,setSortBy]=useState('name');
  const [sortDir,setSortDir]=useState('asc');
  const classes=['All classes',...new Set(characters.map(c=>c.class).filter(Boolean))].sort((a,b)=>a==='All classes'?-1:a.localeCompare(b));
  const abilities=['All abilities',...new Set(characters.map(c=>c.ability).filter(Boolean))].sort((a,b)=>a==='All abilities'?-1:a.localeCompare(b));
  const trajectories=['All trajectories',...new Set(characters.map(c=>c.stats?.Trajectory).filter(Boolean))].sort((a,b)=>a==='All trajectories'?-1:a.localeCompare(b));
  const hitCurves=['All hit curves',...new Set(characters.map(c=>c.stats?.['Hit Curve']).filter(Boolean))].sort((a,b)=>a==='All hit curves'?-1:a.localeCompare(b));
  const numericStatKeys=[...new Set(characters.flatMap(c=>Object.entries(c.stats||{}).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)).map(([key])=>key)))].sort((a,b)=>a.localeCompare(b));
  const sortOptions=[
    {key:'name',label:'Name',group:'General'},
    ...numericStatKeys.map(key=>({key,label:key,group:'Player attributes'})),
    {key:'hitbox:diveRadius',label:'Dive radius',group:'Gameplay hitboxes'},
    {key:'hitbox:regularCatch',label:'Regular catch',group:'Gameplay hitboxes'},
    {key:'hitbox:hitboxHeight',label:'Hitbox height',group:'Gameplay hitboxes'},
    {key:'hitbox:gameplayScale',label:'Gameplay scale',group:'Gameplay hitboxes'},
    ...statisticDefinitions.map(def=>({key:`season:${def.key}`,label:`${def.label}${def.category?` · ${def.category}`:''}`,group:'Season statistics'}))
  ];
  const filtered=useMemo(()=>characters.filter(c=>{
    const q=query.toLowerCase();
    return (c.name.toLowerCase().includes(q)||(c.ability||'').toLowerCase().includes(q))
      && (klass==='All classes'||c.class===klass)
      && (ability==='All abilities'||c.ability===ability)
      && (captain==='All players'||(captain==='Captains'?c.captain:!c.captain))
      && (trajectory==='All trajectories'||c.stats?.Trajectory===trajectory)
      && (hitCurve==='All hit curves'||c.stats?.['Hit Curve']===hitCurve)
      && (draftStatus==='All players'||(draftStatus==='Drafted'?draftedIds.has(String(c.id)):!draftedIds.has(String(c.id))));
  }).sort((a,b)=>{
    const av=getSortValue(a,sortBy), bv=getSortValue(b,sortBy);
    const aMissing=av===null||av===undefined||av===''||typeof av==='number'&&!Number.isFinite(av);
    const bMissing=bv===null||bv===undefined||bv===''||typeof bv==='number'&&!Number.isFinite(bv);
    // Keep unavailable values at the bottom for both ascending and descending sorts.
    if(aMissing!==bMissing) return aMissing?1:-1;
    if(aMissing&&bMissing) return a.name.localeCompare(b.name);
    let cmp=sortBy==='name'?String(av).localeCompare(String(bv)):Number(av)-Number(bv);
    return (sortDir==='asc'?cmp:-cmp)||a.name.localeCompare(b.name);
  }),[query,klass,ability,captain,trajectory,hitCurve,draftStatus,draftedIds,sortBy,sortDir]);
  const resetFilters=()=>{setQuery('');setKlass('All classes');setAbility('All abilities');setCaptain('All players');setTrajectory('All trajectories');setHitCurve('All hit curves');setDraftStatus('All players');setSortBy('name');setSortDir('asc');};
  return <><div className="page-intro"><div><div className="eyebrow">PLAYER DIRECTORY</div><h2>Explore Players</h2><p>Compare player attributes, gameplay hitboxes, and season performance.</p></div><div className="count-pill">{filtered.length} <span>/ {characters.length} players</span></div></div>
    <div className="index-toolbar panel">
      <label className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players or abilities…" /></label>
      <label className="control-label">Sort by<select value={sortBy} onChange={e=>{setSortBy(e.target.value);setSortDir(e.target.value==='name'?'asc':'desc');}}>{['General','Player attributes','Gameplay hitboxes','Season statistics'].map(group=><optgroup key={group} label={group}>{sortOptions.filter(x=>x.group===group).map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</optgroup>)}</select></label>
      <button className="sort-direction" onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')} aria-label={`Sort ${sortDir==='asc'?'descending':'ascending'}`}>{sortDir==='asc'?'↑ Ascending':'↓ Descending'}</button>
      <label className="control-label">Class<select value={klass} onChange={e=>setKlass(e.target.value)}>{classes.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="control-label">Ability<select value={ability} onChange={e=>setAbility(e.target.value)}>{abilities.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="control-label">Roster role<select value={captain} onChange={e=>setCaptain(e.target.value)}><option>All players</option><option>Captains</option><option>Non-captains</option></select></label>
      <label className="control-label">Draft status<select value={draftStatus} onChange={e=>setDraftStatus(e.target.value)}><option>All players</option><option>Drafted</option><option>Undrafted</option></select></label>
      <label className="control-label">Trajectory<select value={trajectory} onChange={e=>setTrajectory(e.target.value)}>{trajectories.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="control-label">Hit curve<select value={hitCurve} onChange={e=>setHitCurve(e.target.value)}>{hitCurves.map(x=><option key={x}>{x}</option>)}</select></label>
      <button className="reset-filters" onClick={resetFilters}>Reset filters</button>
    </div>
    <div className="index-summary"><span>{sortOptions.find(x=>x.key===sortBy)?.label || sortBy} · {sortDir==='asc'?'ascending':'descending'}</span><span>{filtered.length} matching players</span></div>
    <div className="player-grid">{filtered.map(c=><PlayerCard key={c.id} player={c} onClick={()=>onSelect(c)}/>)}</div>{!filtered.length&&<div className="empty-state">No players match those filters.</div>}</>;
}
function ChemistryTab() {
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState('mario');
  const [chemFilter, setChemFilter] = useState('All'); // 'All', 'Good', 'Bad'
  const [classFilter, setClassFilter] = useState('All');

  const activeId = hoveredId || selectedId;

  const width = 840;
  const height = 840;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 290;

  // Filter characters by class if selected to declutter perimeter
  const displayCharacters = useMemo(() => {
    if (classFilter === 'All') return characters;
    return characters.filter(c => (c.class || 'Balanced').toLowerCase() === classFilter.toLowerCase());
  }, [classFilter]);

  // Group characters by class for organized radial sector arrangement
  const nodePositions = useMemo(() => {
    const total = displayCharacters.length;
    const map = new Map();

    // Grouping by class
    const sortedChars = [...displayCharacters].sort((a, b) => 
      (a.class || 'Balanced').localeCompare(b.class || 'Balanced')
    );

    sortedChars.forEach((char, index) => {
      const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      map.set(char.id, { char, x, y, angle });
    });
    return map;
  }, [displayCharacters, cx, cy, radius]);

  const activeCharacter = useMemo(() => {
    return characters.find(c => c.id === activeId) || null;
  }, [activeId]);

  const activeLinks = useMemo(() => {
    if (!activeCharacter) return [];
    const links = [];

    if (chemFilter !== 'Bad') {
      (activeCharacter.goodChemistry || []).forEach(entry => {
        characters.forEach(target => {
          if (activeCharacter.id !== target.id && chemistryMatches(entry, target)) {
            links.push({ targetId: target.id, type: 'good' });
          }
        });
      });
    }

    if (chemFilter !== 'Good') {
      (activeCharacter.badChemistry || []).forEach(entry => {
        characters.forEach(target => {
          if (activeCharacter.id !== target.id && chemistryMatches(entry, target)) {
            links.push({ targetId: target.id, type: 'bad' });
          }
        });
      });
    }

    return links;
  }, [activeCharacter, chemFilter]);

  const connectedMap = useMemo(() => {
    const map = new Map();
    activeLinks.forEach(l => map.set(l.targetId, l.type));
    return map;
  }, [activeLinks]);

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow" style={{ color: '#38bdf8' }}>SYNERGY EXPLORER</div>
          <h2 style={{ color: '#f8fafc' }}>Team Chemistry</h2>
          <p style={{ color: '#94a3b8' }}>Explore the strongest connections and rivalries for each player.</p>
        </div>
      </div>

      <div className="chem-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#1e293b', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid #334155' }}>
        <div className="segmented" style={{ background: '#0f172a', padding: '4px', borderRadius: '8px' }}>
          <button className={chemFilter === 'All' ? 'active' : ''} onClick={() => setChemFilter('All')} style={{ background: chemFilter === 'All' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>All Links</button>
          <button className={chemFilter === 'Good' ? 'active' : ''} onClick={() => setChemFilter('Good')} style={{ background: chemFilter === 'Good' ? '#10b981' : 'transparent', color: '#fff', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>＋ Good Only</button>
          <button className={chemFilter === 'Bad' ? 'active' : ''} onClick={() => setChemFilter('Bad')} style={{ background: chemFilter === 'Bad' ? '#f43f5e' : 'transparent', color: '#fff', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>− Bad Only</button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}
          >
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="panel chart-panel" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', marginTop: '1rem', padding: '1.25rem' }}>
        <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ color: '#f8fafc', margin: 0 }}>{activeCharacter ? `${activeCharacter.name}'s Isolated Radar` : 'Select a Character'}</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0 0' }}>Showing {activeLinks.length} target connections</p>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem', fontWeight: 600, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}/> Good Link</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }}/> Bad Link</span>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#080c14', borderRadius: '16px', overflow: 'hidden', padding: '1.5rem', border: '1px solid #1e293b' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: '750px', height: 'auto', overflow: 'visible' }}>
            {/* Concentric Guide Circles */}
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r={radius * 0.5} fill="none" stroke="#0f172a" strokeWidth="1" strokeDasharray="4 4" />

            {/* Render Selected Dynamic Links */}
            {activeCharacter && activeLinks.map((link, idx) => {
              const target = nodePositions.get(link.targetId);
              if (!target) return null;

              const sourcePos = nodePositions.get(activeCharacter.id) || { x: cx, y: cy };
              const strokeColor = link.type === 'good' ? '#10b981' : '#f43f5e';
              const pathD = `M ${sourcePos.x} ${sourcePos.y} Q ${cx} ${cy} ${target.x} ${target.y}`;

              return (
                <path
                  key={`link-${idx}`}
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="3"
                  strokeDasharray={link.type === 'bad' ? '6 4' : 'none'}
                  opacity="0.9"
                  style={{ filter: `drop-shadow(0 0 8px ${strokeColor}cc)` }}
                />
              );
            })}

            {/* Central Spotlight Node */}
            {activeCharacter && (
              <g transform={`translate(${cx}, ${cy})`}>
                <circle r="46" fill="#0f172a" stroke="#38bdf8" strokeWidth="3.5" style={{ filter: 'drop-shadow(0 0 16px rgba(56, 189, 248, 0.45))' }} />
                <foreignObject x="-40" y="-40" width="80" height="80" style={{ overflow: 'visible', pointerEvents: 'none' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                    <PlayerAvatar player={activeCharacter} />
                  </div>
                </foreignObject>
                <text y="64" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="800">
                  {activeCharacter.name}
                </text>
              </g>
            )}

            {/* Perimeter Characters Nodes & Smart Labels */}
            {Array.from(nodePositions.values()).map(({ char, x, y, angle }) => {
              const isFocused = activeId === char.id;
              const connType = connectedMap.get(char.id);
              const isConnected = !!connType;

              const labelRadius = radius + 22;
              const labelX = cx + labelRadius * Math.cos(angle);
              const labelY = cy + labelRadius * Math.sin(angle);
              const isRightSide = Math.cos(angle) >= 0;

              let nodeFill = '#1e293b';
              let nodeBorder = '#334155';
              let textColor = '#475569';
              let textOpacity = activeId ? (isFocused || isConnected ? 1 : 0.25) : 0.8;

              if (isFocused) {
                nodeFill = '#38bdf8';
                nodeBorder = '#38bdf8';
                textColor = '#38bdf8';
              } else if (connType === 'good') {
                nodeFill = '#10b981';
                nodeBorder = '#10b981';
                textColor = '#34d399';
              } else if (connType === 'bad') {
                nodeFill = '#f43f5e';
                nodeBorder = '#f43f5e';
                textColor = '#f87171';
              }

              return (
                <g
                  key={`node-${char.id}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredId(char.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(selectedId === char.id ? '' : char.id)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isFocused ? "9" : (isConnected ? "7" : "4.5")}
                    fill={nodeFill}
                    stroke={nodeBorder}
                    strokeWidth="2"
                    style={{ transition: 'all 0.15s ease' }}
                  />

                  {/* Text label dims automatically if not part of active subset */}
                  <text
                    x={labelX}
                    y={labelY + 3.5}
                    textAnchor={isRightSide ? 'start' : 'end'}
                    fill={textColor}
                    opacity={textOpacity}
                    fontSize={isFocused || isConnected ? '12' : '10'}
                    fontWeight={isFocused || isConnected ? '700' : '500'}
                    style={{ userSelect: 'none', transition: 'all 0.15s ease' }}
                  >
                    {char.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {activeCharacter && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
          <div className="panel" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ color: '#34d399', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>＋ {activeCharacter.name}'s Good Chemistry</h3>
            <div className="tag-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(activeCharacter.goodChemistry || []).map(x => (
                <span className="chem-tag good" key={x} style={{ background: '#064e3b', color: '#a7f3d0', border: '1px solid #059669', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                  {x}
                </span>
              ))}
              {!activeCharacter.goodChemistry?.length && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>None listed</span>}
            </div>
          </div>

          <div className="panel" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ color: '#f87171', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>− {activeCharacter.name}'s Bad Chemistry</h3>
            <div className="tag-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(activeCharacter.badChemistry || []).map(x => (
                <span className="chem-tag bad" key={x} style={{ background: '#881337', color: '#fecdd3', border: '1px solid #e11d48', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                  {x}
                </span>
              ))}
              {!activeCharacter.badChemistry?.length && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>None listed</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const teamNames = ['Joey','Eshaan','Arnav','Dhruv','Matthew','Alex','Henry','Aadarsh','Jared', 'A1'];
const draftingTeams = teamNames.filter(team => team !== 'A1');
const REGULAR_DRAFT_ROUNDS = 10;
const PICKS_PER_REGULAR_ROUND = draftingTeams.length;
const TOTAL_MANUAL_PICKS = REGULAR_DRAFT_ROUNDS * PICKS_PER_REGULAR_ROUND;
const TOTAL_PLAYER_COUNT = characters.length;
const A1_AUTO_ASSIGNMENT_COUNT = Math.max(0, TOTAL_PLAYER_COUNT - TOTAL_MANUAL_PICKS);
const AUTO_ASSIGNMENT_ROUND = REGULAR_DRAFT_ROUNDS + 1;
function teamForPickIndex(index) {
  if (index < 0 || index >= TOTAL_MANUAL_PICKS) return null;
  const numTeams = draftingTeams.length;
  const round = Math.floor(index / numTeams); 
  const pickInRound = index % numTeams;
  if (round < 2) {
    return draftingTeams[pickInRound];
  }
  const isBackward = (round % 2 === 1);
  const targetIndex = isBackward ? (numTeams - 1 - pickInRound) : pickInRound;
  return draftingTeams[targetIndex];
}
function roundForPickCount(count) {
  if (count >= TOTAL_MANUAL_PICKS) return REGULAR_DRAFT_ROUNDS;
  return Math.floor(count / PICKS_PER_REGULAR_ROUND) + 1;
}
function effectiveDraftPickCount(state) {
  return Array.isArray(state?.picks) ? state.picks.length : 0;
}
function getAutoAssignedPicks(playerPool, manualPicks) {
  if (effectiveDraftPickCount({ picks: manualPicks }) < TOTAL_MANUAL_PICKS) return [];
  const pickedIds = new Set(manualPicks.map(pick => String(pick.playerId)));
  return playerPool.filter(player => !pickedIds.has(String(player.id))).map((player, index) => ({
    round: AUTO_ASSIGNMENT_ROUND,
    pickNumber: TOTAL_MANUAL_PICKS + index + 1,
    team: 'A1',
    playerId: String(player.id),
    automatic: true
  }));
}
function getAllRosterAssignments(state, playerPool) {
  const manualPicks = Array.isArray(state?.picks) ? state.picks : [];
  return [...manualPicks, ...getAutoAssignedPicks(playerPool, manualPicks)];
}

// Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to share the draft
// between browsers. Without them, localStorage remains a local-development fallback.
const INITIAL_DRAFT_STATE = { picks: [], currentTurnIndex: 0, isPaused: false };
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function useSharedDraftState() {
  const [draftState, setDraftState] = useState(readDraftState);
  const [syncStatus, setSyncStatus] = useState(supabase ? 'connecting' : 'local-only');

  useEffect(() => {
    if (supabase) return undefined;
    const refreshFromLocalState = event => setDraftState(event?.detail?.picks ? event.detail : readDraftState());
    window.addEventListener('ss-draft-state-updated', refreshFromLocalState);
    window.addEventListener('storage', refreshFromLocalState);
    return () => {
      window.removeEventListener('ss-draft-state-updated', refreshFromLocalState);
      window.removeEventListener('storage', refreshFromLocalState);
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setSyncStatus('local-only');
      return undefined;
    }
    let alive = true;
    let channel;
    const applyState = state => {
      if (!alive || !state || !Array.isArray(state.picks)) return;
      // Picks are the canonical sequence. This also repairs old/mismatched turn counters.
      const normalized = { ...INITIAL_DRAFT_STATE, ...state, currentTurnIndex: state.picks.length };
      setDraftState(normalized);
      setSyncStatus('live');
    };
    const loadState = async () => {
      const { data, error } = await supabase.from('league_draft_state')
        .select('state').eq('id', 1).single();
      if (!alive) return;
      if (error) {
        console.error('Could not load shared draft:', error);
        setSyncStatus('error');
        return;
      }
      applyState(data?.state);
    };
    channel = supabase.channel('league-draft-state')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'league_draft_state', filter: 'id=eq.1'
      }, payload => applyState(payload.new?.state))
      .subscribe(status => {
        if (!alive) return;
        if (status === 'SUBSCRIBED') loadState();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setSyncStatus('error');
        }
      });
    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Local storage is intentionally only a no-backend development fallback.
  useEffect(() => {
    if (!supabase) {
      try { localStorage.setItem('ss_draft_state', JSON.stringify(draftState)); } catch {}
    }
  }, [draftState]);

  const makePick = async (team, playerId) => {
    if (!supabase) {
      const current = readDraftState();
      const pickCount = effectiveDraftPickCount(current);
      const expectedTeam = teamForPickIndex(pickCount);
      if (!expectedTeam) throw new Error('The 90-pick draft is complete. A1 automatically receives all remaining players.');
      if (team !== expectedTeam) throw new Error(`It is ${expectedTeam}'s turn.`);
      if (current.picks.some(p => String(p.playerId) === String(playerId))) throw new Error('That player has already been drafted.');
      const next = {
        ...current,
        picks: [...current.picks, {
          round: roundForPickCount(pickCount),
          pickNumber: pickCount + 1,
          team: expectedTeam,
          playerId: String(playerId)
        }],
        currentTurnIndex: pickCount + 1
      };
      setDraftState(next);
      window.dispatchEvent(new CustomEvent('ss-draft-state-updated', { detail: next }));
      return next;
    }
    if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase is not configured. Check the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY build variables.');
    const { data, error } = await supabase.rpc('draft_player', { p_team: team, p_player_id: String(playerId) });
    if (error) throw new Error(error.message || 'The database rejected this pick.');
    if (!data || !Array.isArray(data.picks)) throw new Error('The database returned an unexpected draft response. Re-run the supplied Supabase SQL migration.');
    const normalized = { ...INITIAL_DRAFT_STATE, ...data, currentTurnIndex: data.picks.length };
    setDraftState(normalized);
    return normalized;
  };

  const resetSharedDraft = async () => {
    if (!supabase) {
      const empty = { ...INITIAL_DRAFT_STATE };
      setDraftState(empty);
      window.dispatchEvent(new CustomEvent('ss-draft-state-updated', { detail: empty }));
      return empty;
    }
    const { data, error } = await supabase.rpc('reset_league_draft');
    if (error) throw new Error(error.message || 'The database rejected the draft reset.');
    if (!data || !Array.isArray(data.picks)) throw new Error('The database returned an unexpected reset response.');
    const normalized = { ...INITIAL_DRAFT_STATE, ...data, currentTurnIndex: data.picks.length };
    setDraftState(normalized);
    return normalized;
  };

  return { draftState, syncStatus, makePick, resetSharedDraft };
}
// function RostersTab({onSelect}) {
//   const [team,setTeam]=useState('All teams');
//   const rosters=useMemo(()=>{
//     const shuffled=[...characters];
//     for(let i=shuffled.length-1;i>0;i--){
//       const j=Math.floor(Math.random()*(i+1));
//       [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
//     }
//     return teamNames.map((name,i)=>({name,players:shuffled.slice(i*9,(i+1)*9)}));
//   },[]);
//   const visible=rosters.filter(t=>team==='All teams'||t.name===team);
//   return <><div className="page-intro"><div><div className="eyebrow">CPU LEAGUE</div><h2>Team rosters</h2><p>Sample rosters are assigned deterministically for the prototype. Replace the assignment data when your league teams are finalized.</p></div><div className="count-pill">{teamNames.length} <span>teams</span></div></div>
//     <div className="filter-bar"><label className="select-label">Show roster<select value={team} onChange={e=>setTeam(e.target.value)}><option>All teams</option>{teamNames.map(t=><option key={t}>{t}</option>)}</select></label></div>
//     <div className="roster-grid">{visible.map((t,i)=><section className="panel roster-panel" key={t.name}><div className={`team-banner team-${teamNames.indexOf(t.name)}`}><div><span className="eyebrow">TEAM {String(teamNames.indexOf(t.name)+1).padStart(2,'0')}</span><h3>{t.name}</h3></div><span className="team-count">{t.players.length} players</span></div><div className="roster-list">{t.players.map((p,j)=><button className="roster-player" key={p.id} onClick={()=>onSelect(p)}><PlayerAvatar player={p} small/><span className="roster-player-name"><b>{p.name}</b><small>{p.class} · {p.ability || 'No ability listed'}</small></span><span className="roster-rating">{Math.round(fieldScore(p))}</span></button>)}</div></section>)}</div>
//   </>;
// }
// function OutfieldTab() {
//   const [query,setQuery]=useState(''); const [tier,setTier]=useState('All tiers'); const [limit,setLimit]=useState('30');
//   const configurations=useMemo(()=>{
//     const result=[];
//     for(const cf of characters) {
//       const candidates=characters.filter(p=>p.id!==cf.id && hasGoodChemistry(cf,p));
//       for(const lf of candidates) for(const rf of candidates) {
//         if(lf.id===rf.id) continue;
//         const score=(fieldScore(cf)+fieldScore(lf)+fieldScore(rf))/3;
//         const tierInfo=tierFor(score);
//         result.push({cf,lf,rf,score,tier:tierInfo});
//       }
//     }
//     return result.sort((a,b)=>b.score-a.score || a.cf.name.localeCompare(b.cf.name));
//   },[]);
//   const filtered=configurations.filter(x=>(tier==='All tiers'||x.tier.label===tier) && (!query||[x.cf.name,x.lf.name,x.rf.name].some(n=>n.toLowerCase().includes(query.toLowerCase()))));
//   const shown=filtered.slice(0,Number(limit));
//   return <><div className="page-intro"><div><div className="eyebrow">DEFENSIVE LINEUPS</div><h2>Outfield optimizer</h2><p>Center field must have listed good chemistry with both corner outfielders. Configurations are ranked by a transparent fielding score.</p></div><div className="count-pill">{configurations.length.toLocaleString()} <span>valid combos</span></div></div>
//     <div className="formula-note"><b>Ranking formula</b><span>Throw speed 25% · Speed 35% · Fielding 32% · Super Dive bonus +8 points, per player. Tier uses the trio's average score.</span></div>
//     <div className="filter-bar"><label className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search any player in a trio…" /></label><select value={tier} onChange={e=>setTier(e.target.value)} aria-label="Filter by tier"><option>All tiers</option>{['S','A','B','C','D'].map(t=><option key={t} value={t}>{t} tier</option>)}</select><select value={limit} onChange={e=>setLimit(e.target.value)} aria-label="Results per page"><option value="30">Top 30</option><option value="60">Top 60</option><option value="100">Top 100</option></select></div>
//     <div className="outfield-list">{shown.map((x,i)=><article className="panel lineup-card" key={`${x.cf.id}-${x.lf.id}-${x.rf.id}`}><div className="lineup-rank"><span>#{i+1}</span><span className={`tier-badge ${x.tier.cls}`}>{x.tier.label}</span></div><div className="lineup-players">{[['LF',x.lf],['CF',x.cf],['RF',x.rf]].map(([pos,p])=><div className={`lineup-player ${pos==='CF'?'center-player':''}`} key={pos}><PlayerAvatar player={p}/><div><small>{pos==='CF'?'CENTER FIELD':pos==='LF'?'LEFT FIELD':'RIGHT FIELD'}</small><b>{p.name}</b><span>{p.stats['Fielding Throw Speed'] ?? '—'} throw · {p.stats.Speed ?? '—'} speed · {p.stats.Fielding ?? '—'} fielding</span>{p.superDive&&<em>✦ Super Dive</em>}</div></div>)}</div><div className="lineup-score"><b>{x.score.toFixed(1)}</b><small>{x.tier.name}</small></div></article>)}</div>{!shown.length&&<div className="empty-state">No configurations match those filters.</div>}<p className="muted results-note">Showing {shown.length} of {filtered.length.toLocaleString()} matching configurations. Chemistry is evaluated from the center fielder's good-chemistry list; side-to-side chemistry is not required.</p>
//   </>;
// }
function OutfieldTab() {
  const [query,setQuery]=useState(''); const [tier,setTier]=useState('All tiers'); const [limit,setLimit]=useState('30');
  const [locked,setLocked]=useState(['','','']);
  const selectedIds=locked.filter(Boolean);
  const setLock=(index,value)=>setLocked(old=>old.map((v,i)=>i===index?value:v));
  const configurations=useMemo(()=>{
    const result=[];
    for(const cf of characters) {
      const candidates=characters.filter(p=>p.id!==cf.id && hasGoodChemistry(cf,p));
      for(let i=0;i<candidates.length;i++) for(let j=i+1;j<candidates.length;j++) {
        const a=candidates[i],b=candidates[j];
        // Store each pair of corner fielders once; their LF/RF assignment is symmetric for this ranking.
        const trioIds=new Set([cf.id,a.id,b.id]);
        if(selectedIds.some(id=>!trioIds.has(id))) continue;
        const score=(fieldScore(cf)+fieldScore(a)+fieldScore(b))/3;
        const tierInfo=tierFor(score);
        result.push({cf,lf:a,rf:b,score,tier:tierInfo});
      }
    }
    return result.sort((a,b)=>b.score-a.score || a.cf.name.localeCompare(b.cf.name));
  },[selectedIds.join('|')]);
  const filtered=configurations.filter(x=>(tier==='All tiers'||x.tier.label===tier) && (!query||[x.cf.name,x.lf.name,x.rf.name].some(n=>n.toLowerCase().includes(query.toLowerCase()))));
  const shown=filtered.slice(0,Number(limit));
  const playerOptions=[{id:'',name:'No locked player'},...characters.slice().sort((a,b)=>a.name.localeCompare(b.name))];
  return <><div className="page-intro"><div><div className="eyebrow">DEFENSIVE LINEUPS </div><h2>Outfield Possibilities</h2></div><div className="count-pill">{configurations.length.toLocaleString()} <span>matching combos</span></div></div>
    <div className="lock-panel panel"><div className="lock-panel-heading"><div><h3>Lock Players into the Outfield</h3></div><button className="reset-filters" onClick={()=>setLocked(['','',''])}>Clear locks</button></div><div className="lock-selects">{locked.map((value,i)=><label className="control-label" key={i}>Player {i+1}<select value={value} onChange={e=>setLock(i,e.target.value)}>{playerOptions.filter(p=>!p.id||p.id===value||!locked.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}</div>{selectedIds.length>0&&<p className="lock-status">Searching for outfields containing <b>{selectedIds.map(id=>characters.find(c=>c.id===id)?.name).join(' + ')}</b>.</p>}</div>
    <div className="filter-bar"><label className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search any player in a trio…" /></label><select value={tier} onChange={e=>setTier(e.target.value)} aria-label="Filter by tier"><option>All tiers</option>{['S','A','B','C','D'].map(t=><option key={t} value={t}>{t} tier</option>)}</select><select value={limit} onChange={e=>setLimit(e.target.value)} aria-label="Results per page"><option value="30">Top 30</option><option value="60">Top 60</option><option value="100">Top 100</option></select></div>
    <div className="outfield-list">{shown.map((x,i)=><article className="panel lineup-card" key={`${x.cf.id}-${x.lf.id}-${x.rf.id}`}><div className="lineup-rank"><span>#{i+1}</span><span className={`tier-badge ${x.tier.cls}`}>{x.tier.label}</span></div><div className="lineup-players">{[['LF',x.lf],['CF',x.cf],['RF',x.rf]].map(([pos,p])=><div className={`lineup-player ${pos==='CF'?'center-player':''}`} key={pos}><PlayerAvatar player={p}/><div><small>{pos==='CF'?'CENTER FIELD':pos==='LF'?'LEFT FIELD':'RIGHT FIELD'}</small><b>{p.name}</b><span>{p.stats['Fielding Throw Speed'] ?? '—'} throw · {p.stats.Speed ?? '—'} speed · {p.stats.Fielding ?? '—'} fielding</span>{hasSuperDive(p)&&<em>✦ {p.ability} </em>}</div></div>)}</div><div className="lineup-score"><b>{x.score.toFixed(1)}</b><small>{x.tier.name}</small></div></article>)}</div>{!shown.length&&<div className="empty-state">No configurations match those filters. Try clearing a player lock or choosing a different combination.</div>}<p className="muted results-note">Showing {shown.length} of {filtered.length.toLocaleString()} matching configurations. Chemistry is evaluated from the center fielder's good-chemistry list; side-to-side chemistry is not required. Each pair of corner fielders is shown once.</p>
  </>;
}
// 

function readDraftState() {
  try {
    const saved = localStorage.getItem('ss_draft_state');
    if (!saved) return { picks: [], currentTurnIndex: 0, isPaused: false };
    const parsed = JSON.parse(saved);
    const picks = Array.isArray(parsed.picks) ? parsed.picks : [];
    // Do not reinterpret old ten-team/111-pick browser state as the new nine-team schedule.
    const incompatible = picks.length > TOTAL_MANUAL_PICKS
      || picks.some((pick, index) => !draftingTeams.includes(pick?.team) || pick.team !== teamForPickIndex(index))
      || new Set(picks.map(pick => String(pick?.playerId))).size !== picks.length;
    if (incompatible) return { picks: [], currentTurnIndex: 0, isPaused: false };
    return {
      picks,
      currentTurnIndex: picks.length,
      isPaused: Boolean(parsed.isPaused)
    };
  } catch {
    return { picks: [], currentTurnIndex: 0, isPaused: false };
  }
}

function DraftTab({ characters, onSelect }) {
  const [selectedTeam, setSelectedTeam] = useState('');
  const [signedInTeam, setSignedInTeam] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [managerMode, setManagerMode] = useState(false);
  const [mgrPinInput, setMgrPinInput] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [pendingPlayerId, setPendingPlayerId] = useState('');
  const [pendingReset, setPendingReset] = useState(false);
  const pickRequestInFlight = useRef(false);
  const { draftState, syncStatus, makePick, resetSharedDraft } = useSharedDraftState();

  // Demo credentials are configurable in this map; they are client-side, not secure authentication.
  const teamPins = {
    Arnav: '1111', Joey: '2222', Alex: '3333', Jared: '4444', Aadarsh: '5555',
    Dhruv: '6666', Eshaan: '7777', Henry: '8888', Matthew: '0000'
  };
  const leagueManagerPin = '9999';
  const pickCount = effectiveDraftPickCount(draftState);
  const rosterAssignments = getAllRosterAssignments(draftState, characters);
  const draftedIds = new Set(rosterAssignments.map(pick => String(pick.playerId)));
  const availablePlayers = characters.filter(player => !draftedIds.has(String(player.id)));
  const currentTeam = teamForPickIndex(pickCount);
  const currentRound = roundForPickCount(pickCount);
  const draftComplete = pickCount >= TOTAL_MANUAL_PICKS;
  const isConnected = syncStatus === 'live';
  const isOnClock = !draftComplete && (signedInTeam === currentTeam || managerMode);
  const canSubmitPicks = isConnected && !draftComplete && !pendingPlayerId && !pendingReset;

  function signInTeam(event) {
    event.preventDefault();
    if (selectedTeam && pinInput && teamPins[selectedTeam] === pinInput) {
      setSignedInTeam(selectedTeam);
      setPinInput('');
      setAuthMessage(`Signed in as ${selectedTeam}. ${selectedTeam === currentTeam ? 'Your team is on the clock.' : currentTeam ? `${currentTeam} is currently on the clock.` : 'The draft is complete.'}`);
    } else {
      setSignedInTeam('');
      setAuthMessage('Sign-in failed. Check the selected team and PIN.');
    }
  }

  function signOut() {
    setSignedInTeam('');
    setSelectedTeam('');
    setPinInput('');
    setManagerMode(false);
    setAuthMessage('You have signed out.');
  }

  function signInCommissioner(event) {
    event.preventDefault();
    if (mgrPinInput && mgrPinInput === leagueManagerPin) {
      setManagerMode(true);
      setMgrPinInput('');
      setAuthMessage('Commissioner controls unlocked. Picks still follow the configured 90-pick order.');
    } else {
      setAuthMessage('Commissioner sign-in failed. Check the PIN.');
    }
  }

  async function draftPlayer(player) {
    if (pickRequestInFlight.current || pendingPlayerId) return;
    if (!isConnected) {
      setAuthMessage(syncStatus === 'connecting' ? 'The draft is still loading. Please wait a moment before picking.' : 'The draft is temporarily unavailable. Please try again shortly.');
      return;
    }
    if (draftComplete || !currentTeam) {
      setAuthMessage('The draft is complete. No more picks can be made.');
      return;
    }
    if (!managerMode && !signedInTeam) {
      setAuthMessage('Sign in with your team PIN before making a draft pick.');
      return;
    }
    if (!managerMode && signedInTeam !== currentTeam) {
      setAuthMessage(`${signedInTeam} is signed in, but ${currentTeam} is on the clock.`);
      return;
    }
    if (draftedIds.has(String(player.id))) {
      setAuthMessage(`${player.name} has already been drafted. The player pool is refreshing.`);
      return;
    }
    pickRequestInFlight.current = true;
    setPendingPlayerId(String(player.id));
    setAuthMessage(`Submitting ${player.name}'s pick for ${currentTeam}…`);
    try {
      const nextState = await makePick(currentTeam, player.id);
      const nextCount = effectiveDraftPickCount(nextState);
      const nextTeam = teamForPickIndex(nextCount);
      setAuthMessage(nextTeam ? `${player.name} drafted to ${currentTeam}. ${nextTeam} is now on the clock.` : `${player.name} drafted to ${currentTeam}. The 90 manual picks are complete; A1 has automatically received the remaining ${A1_AUTO_ASSIGNMENT_COUNT} players.`);
    } catch (error) {
      console.error('Draft pick failed:', error);
      setAuthMessage('That pick could not be completed. Please try again or contact the league organizer.');
    } finally {
      pickRequestInFlight.current = false;
      setPendingPlayerId('');
    }
  }

  async function resetDraft() {
    if (!managerMode || pendingReset || pendingPlayerId) return;
    if (!window.confirm('Reset all 90 manual draft picks and A1’s automatic assignment? This cannot be undone.')) return;
    setPendingReset(true);
    setAuthMessage('Resetting the shared draft…');
    try {
      await resetSharedDraft();
      setAuthMessage('Draft reset successfully. Arnav is on the clock for pick 1.');
    } catch (error) {
      console.error('Draft reset failed:', error);
      setAuthMessage('The draft could not be reset. Please try again or contact the league organizer.');
    } finally {
      setPendingReset(false);
    }
  }

  return (
    <div className="draft-container">
      <div className="page-intro">
        <div>
          <div className="eyebrow">LIVE LEAGUE DRAFT</div>
          <h2>Draft Room</h2>
          <p>Make your team’s selections and follow the league draft.</p>
        </div>
        <div className="count-pill">{draftComplete ? 'Complete' : `Round ${currentRound}`}<span> · {draftComplete ? `${TOTAL_MANUAL_PICKS} / ${TOTAL_MANUAL_PICKS} picks · ${TOTAL_PLAYER_COUNT} / ${TOTAL_PLAYER_COUNT} players assigned` : `Pick ${pickCount + 1} / ${TOTAL_MANUAL_PICKS} · On clock: ${currentTeam}`}</span></div>
      </div>

      <div className="draft-status-strip">
        
        <div><span className="draft-status-label">YOUR SESSION</span><strong>{managerMode ? 'Commissioner access' : signedInTeam || 'Not signed in'}</strong></div>
        <div><span className="draft-status-label">DRAFT PERMISSION</span><strong className={isOnClock ? 'good-text' : 'muted'}>{draftComplete ? 'Draft complete' : managerMode ? 'Commissioner override' : !signedInTeam ? 'Sign-in required' : isOnClock ? 'Your team is on the clock' : `${currentTeam} is picking`}</strong></div>
        {(signedInTeam || managerMode) && <button className="reset-filters" type="button" onClick={signOut}>Sign out</button>}
      </div>

      {(syncStatus === 'error' || syncStatus === 'local-only') && <div className="draft-error-banner" role="alert"><strong>Draft temporarily unavailable.</strong> Picks are paused. Please try again in a moment or contact the league organizer.</div>}

      <div className="draft-auth-grid">
        <form className="panel draft-auth-card" onSubmit={signInTeam}>
          <div className="eyebrow">TEAM MANAGER</div><h3>Sign in to your team</h3>
          <p>Choose your team and enter its PIN. Selecting a team alone does not grant draft access.</p>
          <label className="control-label">Team<select value={selectedTeam} onChange={event => setSelectedTeam(event.target.value)} required><option value="">Select your team…</option>{draftingTeams.map(team => <option key={team} value={team}>{team}</option>)}</select></label>
          <label className="control-label">Team PIN<input type="password" value={pinInput} onChange={event => setPinInput(event.target.value)} placeholder="Enter team PIN" autoComplete="current-password" required /></label>
          <button className="draft-primary-button" type="submit">Sign in</button>
          {signedInTeam && <p className="draft-session-note">Signed in as <b>{signedInTeam}</b>.</p>}
        </form>
        <form className="panel draft-auth-card" onSubmit={signInCommissioner}>
          <div className="eyebrow">LEAGUE ADMINISTRATION</div><h3>Commissioner access</h3><p>For the league organizer to reset the shared draft.</p>
          {!managerMode ? <><label className="control-label">Commissioner PIN<input type="password" value={mgrPinInput} onChange={event => setMgrPinInput(event.target.value)} placeholder="Enter commissioner PIN" autoComplete="current-password" required /></label><button className="draft-secondary-button" type="submit">Unlock commissioner tools</button></> : <div className="draft-admin-actions"><span className="draft-admin-badge">Commissioner signed in</span><button className="reset-filters" type="button" onClick={resetDraft} disabled={pendingReset || Boolean(pendingPlayerId)}>{pendingReset ? 'Resetting…' : 'Reset entire draft'}</button></div>}
        </form>
      </div>
      {authMessage && <p className="draft-feedback" role="status" aria-live="polite">{authMessage}</p>}

      <section className="panel draft-pool-panel">
        <div className="draft-section-heading"><div><div className="eyebrow">PLAYER POOL</div><h3>Available players</h3></div><span className="count-pill">{availablePlayers.length}<span> available</span></span></div>
        {!signedInTeam && !managerMode && <div className="draft-locked-notice"><strong>Drafting is locked.</strong><span>Browse player profiles, but sign in before selecting anyone.</span></div>}
        <div className="draft-player-grid">
          {availablePlayers.map(player => {
            const canDraft = canSubmitPicks && (managerMode || (Boolean(signedInTeam) && signedInTeam === currentTeam));
            const isPending = pendingPlayerId === String(player.id);
            const waitingText = !isConnected ? (syncStatus === 'connecting' ? 'Loading…' : 'Unavailable') : draftComplete ? 'Draft complete' : !signedInTeam && !managerMode ? 'Sign in to draft' : !canDraft && !managerMode ? `Waiting for ${currentTeam}` : isPending ? 'Submitting…' : pendingPlayerId ? 'Pick in progress…' : `Draft to ${currentTeam}`;
            return <article key={player.id} className={`draft-player-card ${canDraft ? 'draft-player-authorized' : ''}`}>
              <button className="draft-player-info" type="button" onClick={() => onSelect(player)}><PlayerAvatar player={player}/><span className="player-name-wrap"><strong>{player.name}</strong><small>{player.class || 'Class unknown'} · {player.ability || 'No ability listed'}</small></span><span className="arrow">↗</span></button>
              <button type="button" className="draft-pick-button" disabled={!canDraft} onClick={() => draftPlayer(player)} title={canDraft ? `Draft ${player.name}` : waitingText}>{isPending ? 'Submitting pick…' : waitingText}</button>
            </article>;
          })}
        </div>
        {!availablePlayers.length && <div className="empty-state">Every character in the pool has been drafted, or no players remain in the available pool.</div>}
      </section>
    </div>
  );
}

function LineupLabTab({ onSelect }) {
  const [battingOrder, setBattingOrder] = useState(Array(9).fill(''));
  const [defense, setDefense] = useState({ SS: '', '2B': '', LF: '', CF: '', RF: '' });
  const [teamToCompare, setTeamToCompare] = useState(teamNames[0]);
  const [prospectId, setProspectId] = useState('');

  const playersById = useMemo(() => new Map(characters.map(player => [player.id, player])), []);
  const selectedRosterIds = battingOrder.filter(Boolean);
  const selectedRoster = selectedRosterIds.map(id => playersById.get(id)).filter(Boolean);
  const rosterComplete = battingOrder.every(Boolean) && new Set(battingOrder).size === 9;
  const rosterOptions = [{ id: '', name: 'Choose a roster player…' }, ...selectedRoster.slice().sort((a, b) => a.name.localeCompare(b.name))];
  const allPlayerOptions = [{ id: '', name: 'Choose a player…' }, ...characters.slice().sort((a, b) => a.name.localeCompare(b.name))];

  function setBatter(index, id) {
    const replacedId = battingOrder[index];
    setBattingOrder(previous => previous.map((current, slot) => slot === index ? id : current));
    if (replacedId && replacedId !== id) {
      setDefense(previous => Object.fromEntries(
        Object.entries(previous).map(([position, playerId]) => [position, playerId === replacedId ? '' : playerId])
      ));
    }
  }

  function setDefender(position, playerId) {
    setDefense(previous => ({ ...previous, [position]: playerId }));
  }

  const battingChecks = battingOrder.map((id, index) => {
    const player = playersById.get(id);
    const previousId = battingOrder[(index + 8) % 9];
    const previousPlayer = playersById.get(previousId);
    const complete = Boolean(player && previousPlayer);
    return {
      index,
      player,
      previousPlayer,
      complete,
      valid: complete && hasGoodChemistry(player, previousPlayer)
    };
  });

  const defenseEntries = Object.entries(defense).map(([position, id]) => ({
    position,
    player: playersById.get(id),
    id
  }));
  const defensiveIds = defenseEntries.map(entry => entry.id).filter(Boolean);
  const defenseHasDuplicates = new Set(defensiveIds).size !== defensiveIds.length;
  const middleInfieldChecks = ['SS', '2B'].map(position => {
    const player = playersById.get(defense[position]);
    return { position, player, valid: Boolean(player && hasSuperDive(player)) };
  });
  const cf = playersById.get(defense.CF);
  const lf = playersById.get(defense.LF);
  const rf = playersById.get(defense.RF);
  const outfieldChecks = [
    { label: 'CF → LF', valid: Boolean(cf && lf && hasGoodChemistry(cf, lf)) },
    { label: 'CF → RF', valid: Boolean(cf && rf && hasGoodChemistry(cf, rf)) }
  ];
  const battingValid = rosterComplete && battingChecks.every(check => check.valid);
  const defenseComplete = defenseEntries.every(entry => entry.player) && !defenseHasDuplicates;
  const defenseValid = defenseComplete && middleInfieldChecks.every(check => check.valid) && outfieldChecks.every(check => check.valid);
  const validLineup = battingValid && defenseValid;

  // A prospect report is useful to a manager planning the next draft, without altering the saved league roster.
  const savedDraft = useMemo(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('ss_draft_state') || '{"picks":[]}');
      return Array.isArray(parsed.picks) ? parsed.picks : [];
    } catch {
      return [];
    }
  }, []);
  const teamRoster = savedDraft
    .filter(pick => pick.team === teamToCompare)
    .map(pick => playersById.get(pick.playerId))
    .filter(Boolean);
  const prospect = playersById.get(prospectId);
  const prospectConnections = prospect ? teamRoster.map(teammate => ({
    teammate,
    prospectLikesTeammate: hasGoodChemistry(prospect, teammate),
    teammateLikesProspect: hasGoodChemistry(teammate, prospect)
  })) : [];
  const prospectLinkCount = prospectConnections.filter(link => link.prospectLikesTeammate || link.teammateLikesProspect).length;

  function clearBuilder() {
    setBattingOrder(Array(9).fill(''));
    setDefense({ SS: '', '2B': '', LF: '', CF: '', RF: '' });
  }

  return (
    <div className="lineup-lab">
      <div className="page-intro">
        <div>
          <div className="eyebrow">ROSTER PLANNING / CHEMISTRY CHECK</div>
          <h2>Lineup Lab</h2>
          <p>Build a nine-player roster, validate the batting chemistry loop, then assign defensive roles to check your middle infield and outfield.</p>
        </div>
        <div className={`lineup-verdict ${validLineup ? 'is-valid' : 'is-incomplete'}`}>
          <span>{validLineup ? '✓' : '○'}</span>
          <div><strong>{validLineup ? 'Lineup checks out' : 'Needs attention'}</strong><small>{validLineup ? 'All requested constraints pass' : 'Complete the roster and resolve the checks below'}</small></div>
        </div>
      </div>

      <div className="lineup-lab-steps">
        <div className="lineup-step"><b>01</b><span><strong>Choose nine</strong><small>Unique players, in batting order</small></span></div>
        <div className="lineup-step"><b>02</b><span><strong>Assign the defense</strong><small>Five key defensive positions</small></span></div>
        <div className="lineup-step"><b>03</b><span><strong>Review the checks</strong><small>Green means the rule passes</small></span></div>
      </div>

      <section className="panel lineup-builder-panel">
        <div className="draft-section-heading">
          <div><div className="eyebrow">BATTING ORDER</div><h3>Nine-player chemistry loop</h3></div>
          <button type="button" className="reset-filters" onClick={clearBuilder}>Clear lineup</button>
        </div>
        <p className="lineup-help">Each batter must have good chemistry with the batter immediately before them. Batter 1 is checked against batter 9, closing the loop.</p>
        <div className="batting-order-list">
          {battingOrder.map((id, index) => {
            const player = playersById.get(id);
            const check = battingChecks[index];
            const previousPlayer = playersById.get(battingOrder[(index + 8) % 9]);
            const usedElsewhere = new Set(battingOrder.filter((value, slot) => slot !== index && value));
            return (
              <div className={`batter-row ${check.complete ? check.valid ? 'check-pass' : 'check-fail' : ''}`} key={index}>
                <span className="batter-number">{String(index + 1).padStart(2, '0')}</span>
                {player ? <button type="button" className="batter-player-summary" onClick={() => onSelect(player)}><PlayerAvatar player={player} small /><span><strong>{player.name}</strong><small>{player.class || 'Class unknown'} · {player.ability || 'No ability listed'}</small></span></button> : <span className="batter-placeholder">Select batter {index + 1}</span>}
                <label className="control-label batter-select-label">Batter
                  <select value={id} onChange={event => setBatter(index, event.target.value)}>
                    <option value="">Choose player…</option>
                    {characters.slice().sort((a, b) => a.name.localeCompare(b.name)).filter(option => option.id === id || !usedElsewhere.has(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
                <div className={`chem-check ${!check.complete ? 'check-pending' : check.valid ? 'check-pass' : 'check-fail'}`}>
                  <span>{!check.complete ? '○' : check.valid ? '✓' : '!'}</span>
                  <small>{!check.complete ? `Needs batter ${index === 0 ? 9 : index}` : check.valid ? `Good with ${previousPlayer.name}` : `No good chem with ${previousPlayer.name}`}</small>
                </div>
              </div>
            );
          })}
        </div>
        <div className="lineup-summary-row">
          <span>{selectedRoster.length} / 9 unique players selected</span>
          <span className={battingValid ? 'good-text' : 'muted'}>{battingChecks.filter(check => check.valid).length} / 9 chemistry links pass</span>
        </div>
      </section>

      <section className="panel lineup-builder-panel">
        <div className="draft-section-heading">
          <div><div className="eyebrow">DEFENSIVE ASSIGNMENTS</div><h3>Build the defensive spine</h3></div>
          <span className="lineup-rule-chip">Uses the same nine players</span>
        </div>
        <p className="lineup-help">Assign each position to a different player from your selected roster. Shortstop and second base require Super Dive; center field must have good chemistry with both corner outfielders.</p>
        <div className="defense-field">
          <div className="defense-position defense-ss">
            <label>SS <small>Shortstop</small><select value={defense.SS} onChange={event => setDefender('SS', event.target.value)}><option value="">Assign player…</option>{rosterOptions.filter(option => !option.id || option.id === defense.SS || !defensiveIds.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            {defense.SS && <span className={hasSuperDive(playersById.get(defense.SS)) ? 'position-check pass' : 'position-check fail'}>{hasSuperDive(playersById.get(defense.SS)) ? '✓ Super Dive' : '✕ Needs Super Dive'}</span>}
          </div>
          <div className="defense-position defense-2b">
            <label>2B <small>Second base</small><select value={defense['2B']} onChange={event => setDefender('2B', event.target.value)}><option value="">Assign player…</option>{rosterOptions.filter(option => !option.id || option.id === defense['2B'] || !defensiveIds.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            {defense['2B'] && <span className={hasSuperDive(playersById.get(defense['2B'])) ? 'position-check pass' : 'position-check fail'}>{hasSuperDive(playersById.get(defense['2B'])) ? '✓ Super Dive' : '✕ Needs Super Dive'}</span>}
          </div>
          <div className="defense-position defense-lf">
            <label>LF <small>Left field</small><select value={defense.LF} onChange={event => setDefender('LF', event.target.value)}><option value="">Assign player…</option>{rosterOptions.filter(option => !option.id || option.id === defense.LF || !defensiveIds.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            {defense.LF && <span className="position-check neutral">Corner outfielder</span>}
          </div>
          <div className="defense-position defense-cf">
            <label>CF <small>Center field</small><select value={defense.CF} onChange={event => setDefender('CF', event.target.value)}><option value="">Assign player…</option>{rosterOptions.filter(option => !option.id || option.id === defense.CF || !defensiveIds.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <div className="outfield-mini-checks">{outfieldChecks.map(check => <span key={check.label} className={check.valid ? 'pass' : 'fail'}>{check.valid ? '✓' : '○'} {check.label}</span>)}</div>
          </div>
          <div className="defense-position defense-rf">
            <label>RF <small>Right field</small><select value={defense.RF} onChange={event => setDefender('RF', event.target.value)}><option value="">Assign player…</option>{rosterOptions.filter(option => !option.id || option.id === defense.RF || !defensiveIds.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            {defense.RF && <span className="position-check neutral">Corner outfielder</span>}
          </div>
        </div>
        <div className="lineup-summary-row">
          <span>{defenseEntries.filter(entry => entry.player).length} / 5 defensive roles assigned</span>
          <span className={defenseValid ? 'good-text' : 'muted'}>{defenseHasDuplicates ? 'A player is assigned more than once' : defenseValid ? 'All defensive constraints pass' : 'Check Super Dive and outfield chemistry'}</span>
        </div>
      </section>

      <section className="panel prospect-panel">
        <div className="draft-section-heading">
          <div><div className="eyebrow">FUTURE DRAFT PLANNING</div><h3>Would this prospect fit your team?</h3></div>
        </div>
        <p className="lineup-help">Choose a team from the saved draft and a potential addition. This does not change the roster; it summarizes chemistry links the manager could build on in a future draft.</p>
        <div className="prospect-controls">
          <label className="control-label">Team to evaluate
            <select value={teamToCompare} onChange={event => setTeamToCompare(event.target.value)}>{teamNames.map(team => <option key={team}>{team}</option>)}</select>
          </label>
          <label className="control-label">Potential addition
            <select value={prospectId} onChange={event => setProspectId(event.target.value)}><option value="">Choose a prospect…</option>{allPlayerOptions.filter(option => !option.id || !teamRoster.some(player => player.id === option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
          </label>
        </div>
        {prospect ? (
          <div className="prospect-report">
            <div className="prospect-head"><PlayerAvatar player={prospect}/><div><strong>{prospect.name}</strong><small>{prospect.class || 'Class unknown'} · {prospect.ability || 'No ability listed'}</small></div><span className="count-pill">{prospectLinkCount}<span> / {teamRoster.length} connected</span></span></div>
            {!teamRoster.length ? <p className="muted">No saved draft picks for {teamToCompare} yet. Draft picks will appear here once the league draft has started.</p> : (
              <div className="prospect-links">{prospectConnections.map(link => <div key={link.teammate.id} className="prospect-link-row"><span>{link.teammate.name}</span><span className={link.prospectLikesTeammate ? 'good-text' : 'muted'}>{link.prospectLikesTeammate ? 'Prospect likes teammate' : '—'}</span><span className={link.teammateLikesProspect ? 'good-text' : 'muted'}>{link.teammateLikesProspect ? 'Teammate likes prospect' : '—'}</span></div>)}</div>
            )}
            <p className="prospect-caveat">Chemistry can be one-way. Each column shows whether the prospect likes a teammate and whether the teammate likes the prospect.</p>
          </div>
        ) : <div className="empty-state prospect-empty">Select a prospect to preview how they connect to the current team.</div>}
      </section>
    </div>
  );
}

function DraftTabBoard({ characters }) {
  const { draftState } = useSharedDraftState();
  const rounds = REGULAR_DRAFT_ROUNDS + 1;
  const grid = Array.from({ length: rounds }, () => Object.fromEntries(teamNames.map(team => [team, []])));
  const allAssignments = getAllRosterAssignments(draftState, characters);
  allAssignments.forEach(pick => {
    const rowIndex = Number(pick.round) - 1;
    if (rowIndex >= 0 && rowIndex < rounds && grid[rowIndex][pick.team]) {
      const player = characters.find(character => String(character.id) === String(pick.playerId));
      if (player) grid[rowIndex][pick.team].push(player);
    }
  });
  const pickCount = effectiveDraftPickCount(draftState);
  const draftComplete = pickCount >= TOTAL_MANUAL_PICKS;
  return (
    <div>
      <div className="page-intro"><div><div className="eyebrow">LEAGUE OVERVIEW</div><h2>Draft Board Matrix</h2><p>Follow the picks and see each team’s roster take shape.</p></div><div className="count-pill">{pickCount}<span> / {TOTAL_MANUAL_PICKS} manual picks · {draftComplete ? TOTAL_PLAYER_COUNT : pickCount} players assigned</span></div></div>
      <div className="panel board"><table><thead><tr><th className="rn">Rd</th>{teamNames.map(team => <th key={team}>{team}{team === 'A1' ? <small className="board-auto-label"> · AUTO</small> : null}</th>)}</tr></thead><tbody>
        {grid.map((rdData, rowIndex) => <tr key={rowIndex}><td className="rn">{rowIndex < REGULAR_DRAFT_ROUNDS ? `R${rowIndex + 1}` : 'Auto'}</td>{teamNames.map(team => { const players = rdData[team]; return <td key={team} className={`bc ${players.length ? '' : 'empty'} ${rowIndex === REGULAR_DRAFT_ROUNDS && team === 'A1' ? 'supplemental-picks-cell' : ''}`}>
          {players.length ? <div className="board-pick-list">{players.map((player, index) => <div className="board-pick-item" key={`${player.id}-${index}`}><PlayerAvatar player={player} small/><span>{player.name}</span></div>)}</div> : rowIndex === REGULAR_DRAFT_ROUNDS && team === 'A1' && !draftComplete ? 'Assigned after pick 90' : '—'}
        </td>; })}</tr>)}
      </tbody></table></div>
    </div>
  );
}

function RostersTab({ onSelect }) {
  const [team, setTeam] = useState('All teams');
  const { draftState } = useSharedDraftState();

  const rosters = useMemo(() => {
    return teamNames.map(name => {
      const teamPicks = getAllRosterAssignments(draftState, characters).filter(p => p.team === name);
      const players = teamPicks.map(p => characters.find(c => String(c.id) === String(p.playerId))).filter(Boolean);
      return { name, players };
    });
  }, [draftState, characters]);

  const visible = rosters.filter(t => team === 'All teams' || t.name === team);

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">COMMUNITY LEAGUE</div>
          <h2>Team Rosters</h2>
          <p>Browse each team’s roster and select a player to view their profile.</p>
        </div>
        <div className="count-pill">{teamNames.length} <span>teams</span></div>
      </div>
      <div className="filter-bar">
        <label className="select-label">Show roster
          <select value={team} onChange={e => setTeam(e.target.value)}>
            <option>All teams</option>
            {teamNames.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="roster-grid">
        {visible.map((t) => (
          <section className="panel roster-panel" key={t.name}>
            <div className={`team-banner team-${teamNames.indexOf(t.name)}`}>
              <div>
                <span className="eyebrow">TEAM {String(teamNames.indexOf(t.name) + 1).padStart(2, '0')}</span>
                <h3>{t.name}</h3>
              </div>
              <span className="team-count">{t.players.length} players</span>
            </div>
            <div className="roster-list">
              {t.players.map((p) => (
                <button className="roster-player" key={p.id} onClick={() => onSelect(p)}>
                  <PlayerAvatar player={p} small />
                  <span className="roster-player-name"><b>{p.name}</b><small>{p.class} · {p.ability || 'No ability'}</small></span>
                </button>
              ))}
              {!t.players.length && <p className="muted" style={{padding: '12px'}}>No players drafted yet.</p>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default function App() {
  const [tab,setTab]=useState('Players'); const [selected,setSelected]=useState(null);
  return <div className="app-shell"><header className="topbar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('Players')}}><span className="brand-mark">ISA</span><span><b>Ingofs Slugging Association</b><small>LEAGUE HQ</small></span></a><div className="topbar-right">SEASON 3</div></header>
    <main>
    <nav className="tabs" aria-label="Main navigation">{TABS.map((t,i)=><button key={t} onClick={()=>setTab(t)} className={tab===t?'tab active':'tab'}><span className="tab-icon">{['◈','⌘','▤','✎','▦','♧'][i]}</span>{t}</button>)}</nav>
    <section className="content">{tab==='Players'&&<PlayersTab onSelect={setSelected}/>}{tab==='Chemistry'&&<ChemistryTab/>}{tab==='Rosters'&&<RostersTab onSelect={setSelected}/>}{tab==='Outfield'&&<OutfieldTab/>}{tab==='Draft'&&<DraftTab characters={characters} onSelect={setSelected}/>}{tab==='Draft Board'&&<DraftTabBoard characters={characters}/>}</section>
    <footer><span>Ingofs Slugging Association <span className="footer-dot">•</span> Season 3</span></footer></main><PlayerModal player={selected} close={()=>setSelected(null)}/></div>;
}