import React, { useState } from 'react';
import { X } from 'lucide-react';

interface EmailTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMaps: Set<string>;
  selectedRoutes: Set<string>;
}

interface Badge {
  id: string;
  label: string;
  value: string;
}

const EmailTemplate: React.FC<EmailTemplateProps> = ({ isOpen, onClose, selectedMaps, selectedRoutes }) => {
  const badges: Badge[] = [
    { id: 'firstName', label: 'First Name', value: '[First Name]' },
    { id: 'houseNumber', label: 'House Number', value: '[House #]' },
    { id: 'streetName', label: 'Street Name', value: '[Street Name]' },
  ];

  const [emailContent, setEmailContent] = useState<string>(
    `Dear [First Name],

Our Team will be visiting your property to perform your scheduled Core Aeration Service at [House #][Street Name] within the next 24-48 hours.

Service Details:

Your presence is not required during the service. If you have an irrigation system or invisible pet fence, please mark them if possible.

Questions or need to reschedule? Contact our office at 1 (866) 912 5296

Thank you for choosing Canadian Property Stars for your lawn care needs!

The CPS Team`
  );

  const insertBadge = (badge: Badge) => {
    const textarea = document.getElementById('emailContent') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + badge.value + text.substring(end);
    setEmailContent(newText);

    // Reset cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + badge.value.length, start + badge.value.length);
    }, 0);
  };

  const formatEmailContent = (content: string) => {
    return content.split(/(\[First Name\]|\[House #\]|\[Street Name\])/).map((part, index) => {
      if (badges.some(badge => badge.value === part)) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-cps-blue/20 text-blue-300 text-sm font-medium"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleSubmit = () => {
    // Change border color for selected items
    const selectedElements = document.querySelectorAll('[data-selected="true"]');
    selectedElements.forEach((element) => {
      (element as HTMLElement).style.borderColor = '#457b9d';
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Service Notification</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => insertBadge(badge)}
              className="px-2.5 py-1.5 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 text-sm flex items-center gap-1 font-medium"
            >
              {badge.label}
            </button>
          ))}
        </div>

        <div className="relative rounded-md overflow-hidden">
          <div 
            className="absolute inset-0 pointer-events-none p-4 whitespace-pre-wrap text-gray-300 leading-relaxed"
            style={{ fontFamily: 'inherit' }}
          >
            {formatEmailContent(emailContent)}
          </div>
          <textarea
            id="emailContent"
            value={emailContent}
            onChange={(e) => setEmailContent(e.target.value)}
            className="w-full h-[320px] px-4 py-4 bg-transparent border border-gray-600 rounded-md text-transparent caret-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cps-blue focus:border-transparent resize-none leading-relaxed"
            style={{ 
              caretColor: 'white',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit'
            }}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplate;