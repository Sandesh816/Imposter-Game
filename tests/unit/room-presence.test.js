import { createRequire } from 'node:module';
import { expect, test, vi } from 'vitest';
import { applyCommand, updatePresence, settleDisconnect } from '../../functions/room-service.js';

// Import the deployed trigger with its real Functions registration, replacing
// only Admin I/O so an intermittent task-queue outage can be deterministic.
const functionsRequire = createRequire(new URL('../../functions/index.js', import.meta.url));
const enqueue = vi.fn();
let room;
vi.doMock(functionsRequire.resolve('firebase-admin/app').replace('/lib/', '/lib/esm/'), () => ({initializeApp:vi.fn()}));
vi.doMock(functionsRequire.resolve('firebase-admin/database').replace('/lib/', '/lib/esm/'), () => ({getDatabase:()=>({
  ref:()=>({transaction:async reducer=>{
    const value=reducer(structuredClone(room));
    if(value!==undefined)room=value;
    return {committed:value!==undefined,snapshot:{val:()=>structuredClone(room)}};
  }})
})}));
vi.doMock(functionsRequire.resolve('firebase-admin/functions').replace('/lib/', '/lib/esm/'), () => ({getFunctions:()=>({taskQueue:()=>({enqueue})})}));
vi.doMock('node:fs', async importOriginal => ({
  ...await importOriginal(),
  readFileSync:()=>JSON.stringify({countries:{words:['Canada']}})
}));
const {roomPresence}=await import('../../functions/index.js');

test('failed disconnect scheduling is retried with the original deadline and settles once', async()=>{
  expect(roomPresence.__endpoint.eventTrigger.retry).toBe(true);
  const now=Date.now();
  room=applyCommand(null,{uid:'host',action:'create',commandId:'presence-test',payload:{name:'Host'}},{now,catalog:{}});
  room=updatePresence(room,'host',true,now);
  enqueue.mockRejectedValueOnce(new Error('Task queue unavailable')).mockResolvedValueOnce(undefined);
  const event={params:{code:'ABC123',uid:'host'}};
  await expect(roomPresence.run(event)).rejects.toThrow('Task queue unavailable');
  const deadline=room.server.disconnects.host;
  await roomPresence.run(event);
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue.mock.calls.map(([payload])=>payload)).toEqual([
    {code:'ABC123',uid:'host',deadline},{code:'ABC123',uid:'host',deadline}
  ]);
  expect(room.server.disconnects.host).toBe(deadline);
  const settled=settleDisconnect(room,'host',deadline,deadline);
  expect(settled.public.status).toBe('closed');
  expect(settleDisconnect(settled,'host',deadline,deadline).public.status).toBe('closed');
});
