import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | InfinityVibeZ CRM",
  description: "Privacy Policy for our SaaS CRM platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Last Updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            1. Information We Collect
          </h2>
          <p className="mb-4">
            We collect information you provide directly to us when you register for an account, use our services, or communicate with us. This includes account and organizational data, CRM data, and data from connected third-party integrations.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            2. Account and Organization Information
          </h2>
          <p className="mb-4">
            When you create an account, we may collect your name, email address, password, organization details, and payment information to manage your subscription and provide our CRM services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            3. CRM, Contact, and Lead Data
          </h2>
          <p className="mb-4">
            Our platform allows you to store and manage contact information, communication history, and lead data. You retain ownership of this data. We only process this data to provide our services to you.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            4. Connected Third-Party Integrations
          </h2>
          <p className="mb-4">
            Our platform allows you to connect third-party integrations, such as Meta (Instagram, Facebook, WhatsApp), and other service providers. When you connect these services, we receive and store information required to facilitate the integration and process messages on your behalf.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            5. OAuth and Access Tokens
          </h2>
          <p className="mb-4">
            To integrate with third-party platforms, we utilize OAuth and similar authorization flows. We store access tokens and necessary credentials securely in our database to maintain the connection. We use these tokens only to access the authorized APIs as required by the features of our platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            6. Webhooks and Messaging Data
          </h2>
          <p className="mb-4">
            Through connected integrations, we receive events and messages via webhooks. We process and store this messaging data to display conversations within the CRM and enable you to respond to your contacts.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            7. How Data is Used
          </h2>
          <p className="mb-4">
            We use the information we collect to provide, maintain, and improve our CRM platform. This includes processing messages, maintaining integrations, providing customer support, and ensuring the technical functionality of our platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            8. Data Storage and Security
          </h2>
          <p className="mb-4">
            We implement reasonable technical and organizational measures to protect your data against unauthorized access, loss, or alteration. Data is stored in secure databases.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            9. Data Retention
          </h2>
          <p className="mb-4">
            We retain your account and CRM data for as long as your account is active or as needed to provide you services. If you close your account, we will delete your data in accordance with our standard procedures, unless we are required to retain it by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            10. Data Sharing with Service Providers
          </h2>
          <p className="mb-4">
            We may share information with trusted third-party service providers that assist us in operating our platform, such as hosting providers and payment processors. These providers are only authorized to use your data as necessary to provide services to us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            11. Third-Party Services
          </h2>
          <p className="mb-4">
            Our platform contains links and integrations to third-party services (e.g., Meta platforms). These services operate under their own privacy policies. We encourage you to review the privacy policies of any third-party services you connect to our platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            12. User Rights and Data Deletion
          </h2>
          <p className="mb-4">
            You have the right to access, update, or delete the information associated with your account. You can typically manage your data directly within the CRM platform. If you wish to delete your account entirely, or request the removal of specific data, you may contact our support team.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            13. Cookies and Session Technologies
          </h2>
          <p className="mb-4">
            We use cookies and similar session technologies to authenticate your sessions, keep you logged in, and remember your preferences while using the platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            14. Children's Privacy
          </h2>
          <p className="mb-4">
            Our platform is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            15. Changes to the Policy
          </h2>
          <p className="mb-4">
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the platform or via the email address associated with your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            16. Contact Information
          </h2>
          <p className="mb-4">
            If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at privacy@infinityvibez.com (or your designated support channel).
          </p>
        </section>
      </div>
    </div>
  );
}
