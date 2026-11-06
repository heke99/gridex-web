import { customerExtraRoute } from '@/lib/mobile/customerRuntime';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const GET=customerExtraRoute('profile');
import {accountMutation} from '@/lib/mobile/accountWriteRuntime';
export const POST=accountMutation('phone');
