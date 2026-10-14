// Identité de l'organisateur.
// Créer un sondage ouvre une session anonyme, invisible, propre à cet appareil : c'est elle
// qui donne le droit d'annoncer la date. Se connecter avec Google rattache cette session à
// un compte, pour retrouver ses sondages sur n'importe quel appareil.
// Les participants, eux, ne sont jamais connectés.
const auth = firebase.auth();

// Résolue une fois que Firebase a restauré (ou non) la session enregistrée sur l'appareil
const authReady = new Promise(resolve => {
  const stop = auth.onAuthStateChanged(user => { stop(); resolve(user); });
});

function isGoogleUser(user) {
  return !!user && !user.isAnonymous;
}

// Session de l'organisateur : celle qui existe, sinon une nouvelle session anonyme.
// Renvoie null si l'appareil refuse (stockage bloqué, hors ligne) : le sondage est alors
// créé sans organisateur, comme avant.
async function ensureOwnerSession() {
  await authReady;
  if (auth.currentUser) return auth.currentUser;
  try {
    return (await auth.signInAnonymously()).user;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Cède à `target` tous les sondages de la session en cours, puis bascule sur `target`.
// Sert quand le compte Google existe déjà : on ne peut pas lui rattacher la session anonyme,
// donc on lui transmet ses sondages avant de changer de session.
async function transferPollsAndSwitch(target) {
  const from = auth.currentUser;
  if (from && from.uid !== target.uid) {
    const snap = await db.collection('polls').where('ownerUid', '==', from.uid).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.forEach(doc => batch.update(doc.ref, { ownerUid: target.uid }));
      await batch.commit();
    }
  }
  await auth.updateCurrentUser(target);
  return auth.currentUser;
}

// Seconde instance Firebase : permet de connaître le compte Google de destination
// sans quitter la session anonyme qui détient encore les sondages.
function transferAuth() {
  const app = firebase.apps.find(a => a.name === 'transfer')
    || firebase.initializeApp(firebase.app().options, 'transfer');
  return app.auth();
}

async function adoptExistingGoogleAccount(credential) {
  const target = (await transferAuth().signInWithCredential(credential)).user;
  return transferPollsAndSwitch(target);
}

// À appeler directement dans un gestionnaire de clic (sinon la fenêtre Google est bloquée).
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const current = auth.currentUser;
  try {
    if (current && current.isAnonymous) {
      // Garde le même identifiant : les sondages déjà créés restent rattachés
      return (await current.linkWithPopup(provider)).user;
    }
    return (await auth.signInWithPopup(provider)).user;
  } catch (e) {
    if (e.code === 'auth/credential-already-in-use' && e.credential) {
      return adoptExistingGoogleAccount(e.credential);
    }
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      // Navigateur sans fenêtre secondaire (application installée) : on passe par une redirection
      if (current && current.isAnonymous) await current.linkWithRedirect(provider);
      else await auth.signInWithRedirect(provider);
      return null;
    }
    throw e;
  }
}

// Retour d'une connexion par redirection
auth.getRedirectResult().catch(e => {
  if (e.code === 'auth/credential-already-in-use' && e.credential) {
    return adoptExistingGoogleAccount(e.credential);
  }
  console.error(e);
});

function isUserCancel(e) {
  return e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request');
}

// Après un rattachement, le nom n'est porté que par le fournisseur Google
function displayName(user) {
  if (!isGoogleUser(user)) return '';
  return user.displayName || (user.providerData[0] && user.providerData[0].displayName) || user.email || '';
}

function firstName(user) {
  return displayName(user).trim().split(/[\s@]+/)[0] || '';
}
