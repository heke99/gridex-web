export type ConsumptionSelection = {facility:string;from:string;to:string};
export type Consumption = ConsumptionSelection & {items:Array<{reference:string;from:string;to:string;kwh:number;series?:string}>;totalKwh:number;complete:boolean};
export function consumptionSelection(value:unknown):ConsumptionSelection;
export function projectConsumption(input:unknown,selection:ConsumptionSelection):Consumption;
export function createConsumptionHandler(deps:{enabled?:()=>boolean;authenticate:(token:string)=>Promise<unknown>;load:(binding:unknown,selection:ConsumptionSelection)=>Promise<unknown>}):(request:Request)=>Promise<Response>;
