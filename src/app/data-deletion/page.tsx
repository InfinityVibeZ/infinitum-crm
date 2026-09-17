import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | InfinityVibeZ CRM",
  description: "Instructions on how to request deletion of your account and personal data.",
};

export default function DataDeletionPage() {
  const supportEmail = "support@infinityvibez.com";

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8">
          Data Deletion Instructions
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Last Updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <section className="mb-8">
          <p className="mb-4">
            We respect your privacy and provide you with the ability to request the deletion of your account and all associated personal data from our platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            How to Request Account and Data Deletion
          </h2>
          <p className="mb-4">
            To request the permanent deletion of your account, contact information, CRM data, and any other associated personal information, please follow these steps:
          </p>
          <ol className="list-decimal pl-6 mb-4">
            <li className="mb-2">
              Send an email to our support team at <a href={`mailto:${supportEmail}`}>{supportEmail}</a> from the email address associated with your account.
            </li>
            <li className="mb-2">
              Use the subject line: <strong>Account Data Deletion Request</strong>.
            </li>
            <li className="mb-2">
              In the body of the email, state clearly that you wish to have your account and all associated data permanently deleted.
            </li>
          </ol>
          <p className="mb-4">
            Upon receiving your request, we will verify your identity. Once verified, we will process your deletion request in accordance with our standard procedures and applicable laws. Please note that data deletion is a manual process and it may take some time to fully remove all records from our active systems and backups.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Third-Party Integration Data (Meta, Instagram, Facebook)
          </h2>
          <p className="mb-4">
            If you have connected third-party integrations (such as Instagram, Facebook, or WhatsApp) to our CRM:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li className="mb-2">
              <strong>Disconnecting within the CRM:</strong> You can disconnect these integrations directly within the CRM admin panel. This will remove our access tokens and stop the syncing of new data.
            </li>
            <li className="mb-2">
              <strong>Deleting associated data:</strong> Any historical messages or data already synced to our CRM from these integrations will be deleted along with your account when you submit a full data deletion request as outlined above.
            </li>
            <li className="mb-2">
              <strong>Removing app access directly from Meta:</strong> If you wish to completely sever the connection from the provider's side, you must remove our application's access permissions directly within your Meta/Facebook account settings (e.g., via the Business Integrations menu on Facebook).
            </li>
          </ul>
        </section>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Contact Us
          </h2>
          <p className="mb-4">
            If you have any questions or need further assistance regarding data deletion, please reach out to us at <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
