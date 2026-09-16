const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const session=await stripe.checkout.sessions.create({
      mode:'subscription',
      line_items:[{price:process.env.STRIPE_PREMIUM_PRICE_ID||'price_1UGD7bHnFIFV5heOSky6uOBZ',quantity:1}],
      ui_mode:'embedded',
      return_url:(process.env.APP_URL||'https://papaya-app.vercel.app')+'/premium.html?session_id={CHECKOUT_SESSION_ID}'
    });
    return res.status(200).json({clientSecret:session.client_secret});
  }catch(error){
    console.error(error);
    return res.status(500).json({error:'Unable to create checkout session'});
  }
};