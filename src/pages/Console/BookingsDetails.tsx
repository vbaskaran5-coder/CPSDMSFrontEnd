import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { bookingStore } from '../../stores/AdminBookingStore';
import { MasterBooking } from '../../types';
import { format } from 'date-fns';

const BookingsDetails: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<MasterBooking | undefined>(undefined);
  const [currentNote, setCurrentNote] = useState('');
  const [formData, setFormData] = useState({
    routeNumber: '',
    firstName: '',
    lastName: '',
    houseNumber: '',
    streetName: '',
    city: '',
    email: '',
    homePhone: '',
    cellPhone: '',
  });

  useEffect(() => {
    if (bookingId) {
      const fetchedBooking = bookingStore.getBookingById(bookingId);
      if (fetchedBooking) {
        setBooking(fetchedBooking);
        const address = fetchedBooking['Full Address'] || '';
        const firstSpaceIndex = address.indexOf(' ');
        const houseNumber =
          firstSpaceIndex > 0 ? address.substring(0, firstSpaceIndex) : address;
        const streetName =
          firstSpaceIndex > 0 ? address.substring(firstSpaceIndex + 1) : '';

        setFormData({
          routeNumber: fetchedBooking['Route Number'] || '',
          firstName: fetchedBooking['First Name'] || '',
          lastName: fetchedBooking['Last Name'] || '',
          houseNumber: houseNumber,
          streetName: streetName,
          city: fetchedBooking['City'] || '',
          email: fetchedBooking['Email Address'] || '',
          homePhone: fetchedBooking['Home Phone'] || '',
          cellPhone: fetchedBooking['Cell Phone'] || '',
        });
      }
    }
  }, [bookingId]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'currentNote') {
      setCurrentNote(value);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = () => {
    if (bookingId) {
      const fullAddress =
        `${formData.houseNumber} ${formData.streetName}`.trim();
      const adminUser = localStorage.getItem('admin') || 'Admin';
      const newNote =
        currentNote.trim() !== ''
          ? {
              note: currentNote,
              date: new Date().toISOString(),
              user: adminUser,
            }
          : null;

      const updatedNotes = newNote
        ? [newNote, ...(booking?.['Notes'] || [])]
        : booking?.['Notes'];

      bookingStore.updateBooking(bookingId, {
        'Route Number': formData.routeNumber,
        'First Name': formData.firstName,
        'Last Name': formData.lastName,
        'Full Address': fullAddress,
        City: formData.city,
        'Email Address': formData.email,
        'Home Phone': formData.homePhone,
        'Cell Phone': formData.cellPhone,
        Notes: updatedNotes,
      });
      navigate(-1); // Go back to the previous page
    }
  };

  if (!booking) {
    return (
      <div className="text-center text-gray-400 py-12">
        Loading booking details...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft className="text-gray-400" />
        </button>
        <div>
          <h2 className="text-lg font-medium text-white">Edit Booking</h2>
          <p className="text-sm text-gray-400">{booking['Full Address']}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4 max-w-3xl mx-auto">
        {/* Route Code */}
        <div>
          <label
            htmlFor="routeNumber"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Route Code
          </label>
          <input
            type="text"
            name="routeNumber"
            id="routeNumber"
            value={formData.routeNumber}
            onChange={handleInputChange}
            className="input"
          />
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              id="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="input"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              id="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="input"
            />
          </div>
        </div>

        {/* Address */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label
              htmlFor="houseNumber"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              House #
            </label>
            <input
              type="text"
              name="houseNumber"
              id="houseNumber"
              value={formData.houseNumber}
              onChange={handleInputChange}
              className="input"
            />
          </div>
          <div className="col-span-2">
            <label
              htmlFor="streetName"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Street Name
            </label>
            <input
              type="text"
              name="streetName"
              id="streetName"
              value={formData.streetName}
              onChange={handleInputChange}
              className="input"
            />
          </div>
        </div>

        {/* Phone Numbers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="homePhone"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Home Phone
            </label>
            <input
              type="tel"
              name="homePhone"
              id="homePhone"
              value={formData.homePhone}
              onChange={handleInputChange}
              className="input"
            />
          </div>
          <div>
            <label
              htmlFor="cellPhone"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Cell Phone
            </label>
            <input
              type="tel"
              name="cellPhone"
              id="cellPhone"
              value={formData.cellPhone}
              onChange={handleInputChange}
              className="input"
            />
          </div>
        </div>

        {/* City & Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              City
            </label>
            <input
              type="text"
              name="city"
              id="city"
              value={formData.city}
              onChange={handleInputChange}
              className="input"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Email Address
            </label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleInputChange}
              className="input"
            />
          </div>
        </div>

        <div className="flex items-end gap-4 pt-4">
          <div className="flex-1">
            <label
              htmlFor="currentNote"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Add a Note
            </label>
            <textarea
              name="currentNote"
              id="currentNote"
              value={currentNote}
              onChange={handleInputChange}
              className="input h-20 resize-none"
            />
          </div>
          <button
            onClick={handleSave}
            className="bg-cps-blue text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {booking['Notes'] && booking['Notes'].length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 max-w-3xl mx-auto space-y-4">
          <h3 className="text-md font-medium text-white">Saved Notes</h3>
          {booking['Notes'].map((note, index) => (
            <div
              key={index}
              className="border-b border-gray-700 pb-3 last:border-0 last:pb-0"
            >
              <p className="text-gray-300">{note.note}</p>
              <p className="text-xs text-gray-500 mt-2">
                {format(new Date(note.date), "MMM d, yyyy 'at' h:mm a")} by{' '}
                {note.user}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingsDetails;
