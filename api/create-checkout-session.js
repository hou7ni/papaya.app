const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!process.env.STRIPE_SECRET_KEY) return res.status(500).json({error:'Stripe is not configured'});
  try{
    const session=await stripe.checkout.sessions.create({
      mode:'subscription',
      payment_method_types:['card','link'],
      line_items:[{price:process.env.STRIPE_PREMIUM_PRICE_ID||'price_1UGDVfHnFIFV5heO6Nkpczk7',quantity:1}],
      ui_mode:'embedded',
      return_url:(process.env.APP_URL||'https://papaya-app.vercel.app')+'/premium.html?session_id={CHECKOUT_SESSION_ID}'
    });
    return res.status(200).json({clientSecret:session.client_secret,publishableKey:process.env.STRIPE_PUBLISHABLE_KEY||''});
  }catch(error){
    console.error(error);
    return res.status(500).json({error:'Unable to create checkout session'});
  }
};