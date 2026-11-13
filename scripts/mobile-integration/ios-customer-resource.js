/* global CUSTOMER_RESOURCE, output */
var labels={contracts:'Avtal',sites:'Anläggningar',invoices:'Fakturor',profile:'Profil',notifications:'Meddelanden',documents:'Dokument',powers:'Fullmakter',acceptances:'Godkännanden',support:'Support'};
if(!Object.prototype.hasOwnProperty.call(labels,CUSTOMER_RESOURCE))throw new Error('Unknown customer resource selection');
output.customerResourceLabel=labels[CUSTOMER_RESOURCE];
output.customerResourceIdle='customer-'+CUSTOMER_RESOURCE+'-idle';
