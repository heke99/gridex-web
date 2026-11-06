import test from 'node:test';
import assert from 'node:assert/strict';
import React from '../apps/mobile/node_modules/react/index.js';
import Renderer from '../apps/mobile/node_modules/react-test-renderer/index.js';
import {PhoneEditor} from '../apps/mobile/src/PhoneEditor.tsx';
import {gridexBrand} from '../apps/mobile/brands/gridex.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {act}=Renderer;
test('phone editor preserves edited number and only acknowledges confirmed success',async()=>{
 let accepted=false,view;const submit=async phone=>{assert.equal(phone,'0701234567');return accepted;};
 await act(async()=>{view=Renderer.create(React.createElement(PhoneEditor,{value:'0707654321',theme:gridexBrand.theme,busy:false,submit}));});
 await act(async()=>view.root.findByType('TextInput').props.onChangeText('0701234567'));
 await act(async()=>view.root.findByType('Pressable').props.onPress());assert.equal(view.root.findByType('TextInput').props.value,'0701234567');assert.ok(!JSON.stringify(view.toJSON()).includes('Telefonnumret har sparats'));
 accepted=true;await act(async()=>view.root.findByType('Pressable').props.onPress());assert.ok(JSON.stringify(view.toJSON()).includes('Telefonnumret har sparats'));assert.equal(view.root.findByType('Pressable').props.disabled,true);await act(async()=>view.unmount());
});
test('phone editor disables unchanged and in-flight inputs',async()=>{
 let view;await act(async()=>{view=Renderer.create(React.createElement(PhoneEditor,{value:'0701234567',theme:gridexBrand.theme,busy:true,submit:async()=>true}));});
 assert.equal(view.root.findByType('Pressable').props.disabled,true);assert.equal(view.root.findByType('TextInput').props.editable,false);await act(async()=>view.unmount());
});
