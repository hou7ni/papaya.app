const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL='https://xokmhuoqtncownuodqpe.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_rVr3X7iYwJJExCqeBnWTxA_LoUWrede';

module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!process.env.STRIPE_SECRET_KEY) return res.status(500).json({error:'Stripe is not configured'});
  try{
    const auth=req.headers.authorization||'';
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(!token) return res.status(401).json({error:'Authentication required'});
    const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`} });
    if(!userResponse.ok) return res.status(401).json({error:'Invalid authentication'});
    const user=await userResponse.json();
    if(!user?.id) return res.status(401).json({error:'User not found'});

    const session=await stripe.checkout.sessions.create({
      mode:'subscription',
      payment_method_types:['card','link'],
      line_items:[{price:process.env.STRIPE_PREMIUM_PRICE_ID||'price_1UGDVfHnFIFV5heO6Nkpczk7',quantity:1}],
      client_reference_id:user.id,
      metadata:{supabase_user_id:user.id},
      subscription_data:{metadata:{supabase_user_id:user.id}},
      ui_mode:'embedded',
      return_url:(process.env.APP_URL||'https://papaya-app.vercel.app')+'/premium.html?session_id={CHECKOUT_SESSION_ID}'
    });
    return res.status(200).json({clientSecret:session.client_secret,publishableKey:process.env.STRIPE_PUBLISHABLE_KEY||''});
  }catch(error){
    console.error(error);
    return res.status(500).json({error:'Unable to create checkout session'});
  }
};