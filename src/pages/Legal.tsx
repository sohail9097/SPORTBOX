import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Shield, FileText, Cookie, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const Legal = () => {
  const location = useLocation();
  const path = location.pathname.split('/').pop();

  const sections = {
    privacy: {
      title: "Privacy Policy",
      icon: Shield,
      content: (
        <div className="space-y-8">
          <p className="text-[10px] md:text-sm text-white/60 leading-relaxed">
            Welcome to SportBox. Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our platform.
          </p>
          
          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Information We Collect</h3>
            <ul className="list-disc pl-5 space-y-2 text-white/50 text-[9px] md:text-sm">
              <li>Personal information such as name, email address, and payment details when you create an account or subscribe.</li>
              <li>Device information including browser type, IP address, and operating system.</li>
              <li>Usage data such as watch history, preferences, and interaction with content.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">How We Use Your Information</h3>
            <ul className="list-disc pl-5 space-y-2 text-white/50 text-[9px] md:text-sm">
              <li>To provide and improve our streaming services.</li>
              <li>To personalize your viewing experience.</li>
              <li>To process subscriptions and payments securely.</li>
              <li>To send important updates, offers, and notifications.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Data Protection</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              We implement industry-standard security measures to protect your personal data from unauthorized access, misuse, or disclosure.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Third-Party Services</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              We may use trusted third-party providers for payment processing, analytics, and content delivery. These services are required to maintain the confidentiality of your information.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Your Rights</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              You may request access, correction, or deletion of your personal information at any time by contacting our support team.
            </p>
          </section>

          <section className="space-y-4 pt-6 border-t border-white/5">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Contact</h3>
            <p className="text-white/50 text-[9px] md:text-sm italic">
              For privacy-related concerns, contact us at: <span className="text-white font-bold">support@sportbox.com</span>
            </p>
          </section>
        </div>
      )
    },
    terms: {
      title: "Terms of Service",
      icon: FileText,
      content: (
        <div className="space-y-8">
          <p className="text-[10px] md:text-sm text-white/60 leading-relaxed">
            By accessing and using SportBox, you agree to comply with the following terms and conditions.
          </p>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Use of Service</h3>
            <ul className="list-disc pl-5 space-y-2 text-white/50 text-[9px] md:text-sm">
              <li>SportBox provides sports streaming, highlights, and related entertainment content.</li>
              <li>Users must be at least 18 years old or have parental permission to use the platform.</li>
              <li>You agree not to misuse, copy, distribute, or illegally reproduce any content from the service.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Subscription & Payments</h3>
            <ul className="list-disc pl-5 space-y-2 text-white/50 text-[9px] md:text-sm">
              <li>Certain content may require a paid subscription.</li>
              <li>Subscription fees are billed according to the selected plan.</li>
              <li>Payments are non-refundable unless required by law.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Account Responsibility</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and all activities conducted under your account.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Prohibited Activities</h3>
            <ul className="list-disc pl-5 space-y-2 text-white/50 text-[9px] md:text-sm">
              <li>Share accounts with unauthorized users.</li>
              <li>Attempt to hack, disrupt, or interfere with platform operations.</li>
              <li>Upload harmful or illegal content.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Service Availability</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              We strive to provide uninterrupted streaming, but availability may vary due to maintenance, technical issues, or third-party service interruptions.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Changes to Terms</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              SportBox reserves the right to update these Terms of Service at any time. Continued use of the platform indicates acceptance of the updated terms.
            </p>
          </section>

          <section className="space-y-4 pt-6 border-t border-white/5">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Contact</h3>
            <p className="text-white/50 text-[9px] md:text-sm italic">
              For questions regarding these terms: <span className="text-white font-bold">support@sportbox.com</span>
            </p>
          </section>
        </div>
      )
    },
    cookies: {
      title: "Cookie Policy",
      icon: Cookie,
      content: (
        <div className="space-y-8">
          <p className="text-[10px] md:text-sm text-white/60 leading-relaxed">
            SportBox uses cookies and similar technologies to enhance your browsing and streaming experience.
          </p>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">What Are Cookies?</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              Cookies are small text files stored on your device that help websites remember user preferences and improve functionality.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">How We Use Cookies</h3>
            <ul className="list-disc pl-5 space-y-2 text-white/50 text-[9px] md:text-sm">
              <li>Keep users logged in securely.</li>
              <li>Remember viewing preferences and settings.</li>
              <li>Analyze traffic and platform performance.</li>
              <li>Improve content recommendations.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Types of Cookies We Use</h3>
            <ul className="list-disc pl-5 space-y-2 text-white/50 text-[9px] md:text-sm">
              <li>Essential Cookies: Required for basic website functionality.</li>
              <li>Performance Cookies: Help us understand user interaction and improve performance.</li>
              <li>Preference Cookies: Store user settings and preferences.</li>
              <li>Analytics Cookies: Provide insights into website usage and visitor behavior.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Managing Cookies</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              You can manage or disable cookies through your browser settings. Some features of the platform may not function properly if cookies are disabled.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Updates to This Policy</h3>
            <p className="text-white/50 text-[9px] md:text-sm leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in technology or legal requirements.
            </p>
          </section>

          <section className="space-y-4 pt-6 border-t border-white/5">
            <h3 className="text-[14px] md:text-xl font-black uppercase italic tracking-tighter text-brand">Contact</h3>
            <p className="text-white/50 text-[9px] md:text-sm italic">
              For any cookie-related questions: <span className="text-white font-bold">support@sportbox.com</span>
            </p>
          </section>
        </div>
      )
    }
  };

  const currentSection = sections[path as keyof typeof sections] || sections.privacy;
  const SectionIcon = currentSection.icon;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar Nav */}
          <div className="md:w-64 flex-shrink-0 space-y-2">
            {Object.entries(sections).map(([id, section]) => (
              <Link
                key={id}
                to={`/legal/${id}`}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  path === id 
                    ? 'bg-brand/10 border-brand/20 text-brand' 
                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <section.icon className="w-4 h-4" />
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{section.title}</span>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${path === id ? 'rotate-90' : ''}`} />
              </Link>
            ))}
          </div>

          {/* Content Area */}
          <motion.div 
            key={path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-grow glass-card p-5 md:p-12"
          >
            <div className="flex items-center gap-4 mb-8 pb-8 border-b border-white/5">
              <div className="p-3 bg-brand/10 rounded-xl">
                <SectionIcon className="w-6 h-6 text-brand" />
              </div>
              <h1 className="text-xl md:text-5xl font-black uppercase italic tracking-tighter">{currentSection.title}</h1>
            </div>
            {currentSection.content}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Legal;
