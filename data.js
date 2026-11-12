const KEY="pixelgalaxy-v3",R=["energy","metal","crystal","credits"];
const B={
solar:{n:"Solar Array",d:"Makes energy",c:{metal:10},p:{energy:1}},
foundry:{n:"Metal Foundry",d:"Refines metal",c:{energy:10},p:{metal:.8}},
mine:{n:"Crystal Mine",d:"Digs crystal",c:{metal:25,energy:10},p:{crystal:.6}},
hub:{n:"Trade Hub",d:"Earns credits",c:{metal:30,crystal:20},p:{credits:.5}},
hangar:{n:"Hangar",d:"Holds 5+ ship slots per level (research adds more)",c:{metal:40,crystal:30},p:{}},
command:{n:"Command Station",d:"Raises building cap, storage and fleet power",c:{metal:60,crystal:40,credits:20},p:{}}
};
const U={
fighter:{n:"Fighter",pw:1,sz:1,h:1,c:{energy:10,credits:5}},
cruiser:{n:"Cruiser",pw:3,sz:2,h:2,c:{metal:25,crystal:10,credits:10}},
capital:{n:"Capital Ship",pw:8,sz:4,h:4,c:{metal:80,crystal:50,credits:40}}
};
const WEAK={swarm:"fighter",armored:"cruiser",fortress:"capital"};
const SYS=[
{n:"Home World",x:16,y:40,l:[1,2]},
{n:"Pirate Outpost",t:"swarm",pw:5,r:{metal:60,credits:20},x:42,y:20,l:[0,3]},
{n:"Derelict Station",t:"armored",pw:12,r:{crystal:80,credits:50},x:42,y:62,l:[0,4,5]},
{n:"Rogue Belt",t:"swarm",pw:28,r:{energy:150,credits:120},x:72,y:12,l:[1,6]},
{n:"Void Foundry",t:"armored",pw:45,r:{metal:300,credits:150},x:70,y:42,l:[2,6]},
{n:"Nebula Fortress",t:"fortress",pw:90,r:{credits:300,crystal:150},x:72,y:70,l:[2,7]},
{n:"Raider Armada",t:"swarm",pw:160,r:{credits:800,metal:300,crystal:300},x:100,y:24,l:[3,4,7]},
{n:"Alien Hive Core",t:"fortress",pw:260,r:{credits:2000},x:108,y:56,l:[5,6,8]},
{n:"Ion Reef",t:"armored",pw:300,r:{credits:1500,metal:600},x:92,y:88,l:[7,9]},
{n:"Void Gate",t:"fortress",pw:450,r:{credits:2000,crystal:800},x:66,y:100,l:[8,10]},
{n:"Mercenary Yard",t:"swarm",pw:650,r:{credits:2500,metal:900,crystal:600},x:36,y:96,l:[9,11]},
{n:"Ghost Fleet",t:"armored",pw:900,r:{credits:3000,energy:1000},x:22,y:122,l:[10,12]},
{n:"Pulsar Station",t:"fortress",pw:1200,r:{credits:3500,crystal:1500},x:48,y:138,l:[11,13]},
{n:"Rift Armada",t:"swarm",pw:1600,r:{credits:4000,metal:2000},x:80,y:128,l:[12,14]},
{n:"Titan Dreadnought",t:"armored",pw:2000,r:{credits:4500,metal:2000,crystal:2000},x:108,y:112,l:[13,15]},
{n:"The Dark Nexus",t:"fortress",pw:2800,r:{credits:6000},x:100,y:148,l:[14]}
];
const DUR={fighter:3,cruiser:8,capital:20};
const POS0={solar:[1,1],foundry:[2,1],mine:[3,1],hub:[4,1],hangar:[5,1],command:[3,2]};
const Q=[
{id:"q1",t:"Build a Crystal Mine",ok:()=>S.b.mine>=1,r:{metal:40}},
{id:"q2",t:"Build a Hangar",ok:()=>S.b.hangar>=1,r:{crystal:40,metal:40}},
{id:"q3",t:"Launch your first ship",ok:()=>total()>=1,r:{energy:60,credits:20}},
{id:"q4",t:"Conquer the Pirate Outpost",ok:()=>S.won.includes(1),r:{credits:80}},
{id:"q5",t:"Upgrade the Command Station to Lv 2",ok:()=>S.b.command>=2,r:{metal:100,crystal:60}},
{id:"q5b",t:"Research your first technology",ok:()=>S.tech.length>=1,r:{credits:80,crystal:40}},
{id:"q5c",t:"Hire a commander",ok:()=>S.cmds.length>=1,r:{credits:100}},
{id:"q6",t:"Cluster buildings for a +30% bonus",ok:()=>Object.keys(B).some(id=>S.b[id]>0&&mult(id)>=1.3),r:{credits:60}},
{id:"q7",t:"Build a Cruiser",ok:()=>S.ships.cruiser>=1,r:{credits:100,crystal:60}},
{id:"q8",t:"Own 4 systems",ok:()=>S.won.length>=5,r:{credits:300,metal:200}},
{id:"q9",t:"Build a Capital Ship",ok:()=>S.ships.capital>=1,r:{credits:300,crystal:150}},
{id:"q10",t:"Conquer the Alien Hive Core",ok:()=>S.won.includes(7),r:{credits:1000}},
{id:"q14",t:"Repel a rival raid",ok:()=>S.rep>=1,r:{credits:600,metal:300}},
{id:"q15",t:"Capture a rival-held system",ok:()=>S.cap>=1,r:{credits:800,crystal:400}},
{id:"q11",t:"Own 9 systems",ok:()=>S.won.length>=9,r:{credits:1500,metal:600}},
{id:"q12",t:"Complete 6 technologies",ok:()=>S.tech.length>=6,r:{credits:2000,crystal:1000}},
{id:"q13",t:"Conquer the Dark Nexus",ok:()=>S.won.includes(15),r:{credits:5000}}
];
const TT={fleet:"fleet power",econ:"production",build:"faster building and research"};
const CM={
vex:{n:"Admiral Vex",t:"fleet",b:.05,c:150,d:"Fleet commander. Boosts fleet power."},
kade:{n:"Commodore Kade",t:"fleet",b:.08,c:700,d:"Elite fleet commander. Big fleet power boost."},
orla:{n:"Director Orla",t:"econ",b:.05,c:150,d:"Station manager. Boosts production."},
juno:{n:"Quartermaster Juno",t:"econ",b:.08,c:700,d:"Master of supply. Big production boost."},
tam:{n:"Engineer Tamsin",t:"build",b:.04,c:300,d:"Chief builder. Faster building, shipyard and research."},
bolt:{n:"Chief Bolt",t:"build",b:.06,c:1200,d:"Legendary engineer. Much faster builds."}
};
const TECH=[
{id:"w1",n:"Laser Cannons",d:"+15% fleet power",c:{credits:150,crystal:80},t:60,k:"pw",v:.15},
{id:"w2",n:"Plasma Weapons",d:"+25% fleet power",c:{credits:600,crystal:300},t:180,req:"w1",k:"pw",v:.25},
{id:"w3",n:"Antimatter Warheads",d:"+40% fleet power",c:{credits:2500,crystal:1200},t:600,req:"w2",k:"pw",v:.4},
{id:"e1",n:"Efficient Reactors",d:"+20% production",c:{credits:200,metal:150},t:90,k:"eco",v:.2},
{id:"e2",n:"Asteroid Mining",d:"+30% production",c:{credits:800,metal:500},t:300,req:"e1",k:"eco",v:.3},
{id:"e3",n:"Dyson Swarm",d:"+50% production",c:{credits:3000,metal:1500},t:900,req:"e2",k:"eco",v:.5},
{id:"h1",n:"Reinforced Hulls",d:"Fewer ships lost in battle",c:{credits:400,metal:200},t:120,k:"keep",v:.1},
{id:"h2",n:"Repair Drones",d:"Even fewer ships lost",c:{credits:1500,metal:800},t:400,req:"h1",k:"keep",v:.1},
{id:"l1",n:"Bigger Hangars",d:"+2 ship slots per Hangar level",c:{credits:500,crystal:200},t:150,k:"slot",v:2},
{id:"l2",n:"Orbital Docks",d:"+3 more ship slots per Hangar level",c:{credits:2000,crystal:800},t:500,req:"l1",k:"slot",v:3},
{id:"c1",n:"Advanced Command",d:"Command Station max level 7",c:{credits:1000,crystal:500},t:300,k:"cmax",v:2},
{id:"c2",n:"Fleet Doctrine",d:"Command Station max level 10",c:{credits:3000,crystal:2000},t:1200,req:"c1",k:"cmax",v:3}
];
const RV={c:{n:"Crimson Pact",b:150},v:{n:"Vael Collective",b:250}};
