import test from 'node:test';
import assert from 'node:assert/strict';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
import {ContractActions} from '../apps/mobile/src/ContractActions.tsx';
import {gridexBrand} from '../apps/mobile/brands/gridex.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act}=Renderer;
test('native contract actions open only expected web routes without session handoff',async()=>{
 const opened=[];globalThis.__contractLinkFixture=async(...args)=>opened.push(args);let view;
 await act(async()=>{view=Renderer.create(React.createElement(ContractActions,{origin:'https://gridex.se',theme:gridexBrand.theme}));});
 for(const button of view.root.findAllByType('Pressable'))await act(async()=>button.props.onPress());
 assert.deepEqual(opened,[['https://gridex.se/teckna'],['https://gridex.se/dashboard/contracts'],['https://gridex.se/dashboard/support']]);await act(async()=>view.unmount());delete globalThis.__contractLinkFixture;
});
test('template hides unconfigured web actions and displays safe retry error',async()=>{
 let view;await act(async()=>{view=Renderer.create(React.createElement(ContractActions,{theme:gridexBrand.theme}));});assert.equal(view.toJSON(),null);await act(async()=>view.unmount());
 globalThis.__contractLinkFixture=async()=>{throw Error('private native exception');};await act(async()=>{view=Renderer.create(React.createElement(ContractActions,{origin:'https://gridex.se',theme:gridexBrand.theme}));});
 await act(async()=>view.root.findAllByType('Pressable')[0].props.onPress());const json=JSON.stringify(view.toJSON());assert.ok(json.includes('Sidan kunde inte öppnas'));assert.ok(!json.includes('private native exception'));await act(async()=>view.unmount());delete globalThis.__contractLinkFixture;
});
