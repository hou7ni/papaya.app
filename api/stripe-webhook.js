const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL='https://xokmhuoqtncownuodqpe.supabase.co';

async function setPremium(userId,isPremium,subscriptionId='',customerId=''){
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  const response=await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`,{
    method:'POST',
    headers:{
      apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates'
    },
    body:JSON.stringify({id:userId,is_premium:isPremium,stripe_subscription_id:subscriptionId||null,stripe_customer_id:customerId||null,updated_at:new Date().toISOString()})
  });
  if(!response.ok) throw new Error(`Supabase update failed: ${response.status} ${await response.text()}`);
}

function getUserIdFromSubscription(subscription){
  return subscription?.metadata?.supabase_user_id||'';
}

module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).send('Method not allowed');
  if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET||!process.env.SUPABASE_SERVICE_ROLE_KEY){
    return res.status(500).send('Webhook is not configured');
  }

  const signature=req.headers['stripe-signature'];
  if(!signature) return res.status(400).send('Missing Stripe signature');

  try{
    const chunks=[];
    for await(const chunk of req) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
    const rawBody=Buffer.concat(chunks);
    const event=stripe.webhooks.constructEvent(rawBody,signature,process.env.STRIPE_WEBHOOK_SECRET);

    if(event.type==='checkout.session.completed'){
      const session=event.data.object;
      if(session.mode==='subscription'&&session.payment_status==='paid'){
        let userId=session.metadata?.supabase_user_id||session.client_reference_id||'';
        let subscriptionId=typeof session.subscription==='string'?session.subscription:session.subscription?.id||'';
        if(!userId&&subscriptionId){
          const subscription=await stripe.subscriptions.retrieve(subscriptionId);
          userId=getUserIdFromSubscription(subscription);
        }
        if(userId) await setPremium(userId,true,subscriptionId,typeof session.customer==='string'?session.customer:'');
      }
    }

    if(event.type==='invoice.paid'){
      const invoice=event.data.object;
      const subscriptionId=typeof invoice.subscription==='string'?invoice.subscription:invoice.subscription?.id||'';
      if(subscriptionId){
        const subscription=await stripe.subscriptions.retrieve(subscriptionId);
        const userId=getUserIdFromSubscription(subscription);
        if(userId) await setPremium(userId,true,subscription.id,typeof invoice.customer==='string'?invoice.customer:'');
      }
    }

    if(event.type==='invoice.payment_failed'){
      const invoice=event.data.object;
      const subscriptionId=typeof invoice.subscription==='string'?invoice.subscription:invoice.subscription?.id||'';
      if(subscriptionId){
        const subscription=await stripe.subscriptions.retrieve(subscriptionId);
        const userId=getUserIdFromSubscription(subscription);
        if(userId) await setPremium(userId,false,subscription.id,typeof invoice.customer==='string'?invoice.customer:'');
      }
    }

    if(event.type==='customer.subscription.updated'){
      const subscription=event.data.object;
      const userId=getUserIdFromSubscription(subscription);
      if(userId){
        const active=['active','trialing'].includes(subscription.status);
        await setPremium(userId,active,subscription.id,typeof subscription.customer==='string'?subscription.customer:'');
      }
    }

    if(event.type==='customer.subscription.deleted'){
      const subscription=event.data.object;
      const userId=getUserIdFromSubscription(subscription);
      if(userId) await setPremium(userId,false,subscription.id,typeof subscription.customer==='string'?subscription.customer:'');
    }

    return res.status(200).json({received:true});
  }catch(error){
    console.error(error);
    return res.status(400).send('Webhook error');
  }
};
