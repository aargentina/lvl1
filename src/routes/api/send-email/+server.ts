import { RESEND_API_KEY } from '$env/static/private';
import { Resend } from 'resend';
import { json } from '@sveltejs/kit';

const resend = new Resend(RESEND_API_KEY);

export const prerender = false;

export async function POST({ request }) {
	const formData = await request.formData();

	// Check if this is a reservation form or contact form
	const isReservation = formData.get('organizerName') !== null;

	try {
		let subject, html;

		if (isReservation) {
			// Large Group Reservation Form
			// Unique subject per request so Gmail doesn't thread separate requests into one conversation
			const date = new Date(`${formData.get('date')}T00:00:00Z`).toLocaleDateString('en-US', {
				weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
			});
			subject = `Large Group Request: ${date} · ${formData.get('peopleCount')} people · ${formData.get('organizerName')}`;
			html = `
				<h1>New Large Group Reservation Request</h1>
				<h2>Contact Information</h2>
				<p><strong>Organizer Name:</strong> ${formData.get('organizerName')}</p>
				<p><strong>Phone:</strong> ${formData.get('phone')}</p>
				<p><strong>Email:</strong> ${formData.get('email')}</p>
				<p><strong>Organization:</strong> ${formData.get('organization') || 'Not provided'}</p>
				
				<h2>Event Details</h2>
				<p><strong>Number of People:</strong> ${formData.get('peopleCount')}</p>
				<p><strong>Preferred Date:</strong> ${formData.get('date')}</p>
				<p><strong>Preferred Time:</strong> ${formData.get('time')}</p>
				<p><strong>Game Type:</strong> ${formData.get('gameType')}</p>
				<p><strong>Payment Arrangements:</strong> ${formData.get('paymentArrangements')}</p>
				
				<h2>Additional Requirements</h2>
				<p>${formData.get('additionalRequirements') || 'None provided'}</p>
			`;
		} else {
			// Regular Contact Form
			subject = 'New Contact Form Submission';
			html = `
				<h1>New Contact Form Submission</h1>
				<p><strong>Name:</strong> ${formData.get('name')}</p>
				<p><strong>Email:</strong> ${formData.get('email')}</p>
				<p><strong>Message:</strong> ${formData.get('message')}</p>
			`;
		}

		const { error } = await resend.emails.send({
			from: 'send@levelonegamepub.com',
			to: ['levelonereservations@gmail.com'],
			subject,
			html
		});

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch {
		return json({ success: false, error: 'Failed to send email' }, { status: 500 });
	}
}
