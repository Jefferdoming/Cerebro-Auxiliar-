import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Fingerprint } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', res.user.uid), {
          userId: res.user.uid,
          name: email.split('@')[0],
          role: 'user',
          onboardingComplete: false,
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError('Algo deu errado. Verifique seus dados.');
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      await setDoc(doc(db, 'users', res.user.uid), {
        userId: res.user.uid,
        name: res.user.displayName || res.user.email?.split('@')[0] || 'Usuário',
        role: 'user',
        onboardingComplete: false,
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      setError('Falha ao entrar com Google.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-10 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Fingerprint className="w-16 h-16 text-brand-primary mx-auto mb-4" />
          <h1 className="text-3xl font-black text-slate-800 mb-2">Cérebro Auxiliar</h1>
          <p className="text-slate-500">Seu suporte diário para TDAH</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="adhd-card !p-2">
            <input
              type="email"
              placeholder="E-mail"
              className="w-full p-4 rounded-2xl outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="adhd-card !p-2">
            <input
              type="password"
              placeholder="Senha"
              className="w-full p-4 rounded-2xl outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-center text-sm">{error}</p>}

          <button type="submit" className="big-btn bg-brand-primary text-white">
            {isRegistering ? <UserPlus size={24} /> : <LogIn size={24} />}
            {isRegistering ? 'Criar Conta' : 'Entrar Agora'}
          </button>
        </form>

        <div className="mt-6">
          <button 
            onClick={signInWithGoogle}
            className="big-btn bg-white text-slate-700 border-2 border-slate-100 shadow-none"
          >
            Entrar com Google
          </button>
        </div>

        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="w-full text-center mt-6 text-brand-primary font-bold"
        >
          {isRegistering ? 'Já tenho uma conta' : 'Ainda não tenho conta'}
        </button>
      </motion.div>
    </div>
  );
}
