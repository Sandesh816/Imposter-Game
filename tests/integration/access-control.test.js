import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, test } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update } from 'firebase/database';
let env;
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-imposter-review',database:{host:'127.0.0.1',port:9002,rules:readFileSync('database.rules.json','utf8')}})});
afterAll(async()=>env?.cleanup());
beforeEach(async()=>{
 await env.clearDatabase();
 await env.withSecurityRulesDisabled(async context=>{await set(ref(context.database()),{
  rooms:{OLD:{secretWord:'Canada'}},
  roomsV2:{ROOM01:{members:{host:true,alice:true},public:{revision:0,host:'host',status:'playing',players:{host:{name:'Host'},alice:{name:'Alice'}}},private:{host:{isImposter:true},alice:{secretWord:'Canada'}},server:{secretWord:'Canada'}}},
  leagues:{LEAGUE:{createdBy:'host',version:2,members:{host:true,alice:true},admins:{host:true},players:{alice:{points:0}}}},
  communityCategories:{CATEGORY:{authorUid:'host',name:'Test',words:['One','Two','Three'],upvotes:0}}
 });});
});
const db=uid=>env.authenticatedContext(uid).database();
test('outsiders cannot enumerate, read secrets, delete old rooms or edit scores',async()=>{
 const outsider=db('outsider');
 for(const path of ['rooms','rooms/OLD','roomsV2','roomsV2/ROOM01','roomsV2/ROOM01/public','leagues/LEAGUE']) await assertFails(get(ref(outsider,path)));
 await assertFails(set(ref(outsider,'rooms/OLD'),null));
 await assertFails(set(ref(outsider,'leagues/LEAGUE/players/alice/points'),999));
});
test('members can see public state and only their private role',async()=>{
 const alice=db('alice');
 await assertSucceeds(get(ref(alice,'roomsV2/ROOM01/public')));
 await assertSucceeds(get(ref(alice,'roomsV2/ROOM01/private/alice')));
 for(const path of ['roomsV2/ROOM01','roomsV2/ROOM01/private','roomsV2/ROOM01/private/host','roomsV2/ROOM01/server']) await assertFails(get(ref(alice,path)));
 for(const path of ['public/status','members/alice','private/alice','server']) await assertFails(set(ref(alice,`roomsV2/ROOM01/${path}`),true));
});
test('presence belongs to the authenticated member, chat cannot impersonate',async()=>{
 const alice=db('alice');
 await assertSucceeds(set(ref(alice,'roomsV2/ROOM01/connections/alice/tab1'),true));
 await assertFails(set(ref(alice,'roomsV2/ROOM01/connections/host/tab1'),true));
 const message={playerId:'alice',playerName:'Alice',text:'Hello',timestamp:Date.now()};
 await assertSucceeds(set(ref(alice,'roomsV2/ROOM01/chat/message1'),message));
 await assertFails(set(ref(alice,'roomsV2/ROOM01/chat/message2'),{...message,playerId:'host'}));
 await assertFails(update(ref(alice,'roomsV2/ROOM01/chat/message1'),{text:'changed'}));
});
test('voice inbox is recipient-readable and sender identity is enforced',async()=>{
 const alice=db('alice'),host=db('host');
 await assertSucceeds(set(ref(alice,'roomsV2/ROOM01/voiceUsers/alice'),{muted:false,joinedAt:Date.now()}));
 await assertSucceeds(set(ref(alice,'roomsV2/ROOM01/voiceSignals/host/signal1'),{from:'alice',type:'offer',data:'{}'}));
 await assertSucceeds(get(ref(host,'roomsV2/ROOM01/voiceSignals/host')));
 await assertFails(get(ref(alice,'roomsV2/ROOM01/voiceSignals/host')));
 await assertFails(set(ref(alice,'roomsV2/ROOM01/voiceSignals/host/signal2'),{from:'host',type:'offer',data:'{}'}));
 await assertSucceeds(set(ref(host,'roomsV2/ROOM01/voiceSignals/host'),null));
});
test('league membership never permits admin promotion or another author edit',async()=>{
 const alice=db('alice');
 await assertSucceeds(get(ref(alice,'leagues/LEAGUE')));
 await assertFails(set(ref(alice,'leagues/LEAGUE/admins/alice'),true));
 await assertFails(set(ref(alice,'leagues/LEAGUE/createdBy'),'alice'));
 await assertFails(set(ref(alice,'leagues/LEAGUE/players/alice/points'),10));
 await assertFails(update(ref(alice,'communityCategories/CATEGORY'),{name:'Changed'}));
 await assertFails(update(ref(alice,'communityCategories/CATEGORY'),{upvotes:10}));
 await assertSucceeds(get(ref(env.unauthenticatedContext().database(),'communityCategories')));
});
