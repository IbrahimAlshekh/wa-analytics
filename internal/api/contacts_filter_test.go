package api

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

func makeContact(id int64, name, phone string) db.Contact {
	return db.Contact{ID: id, DisplayName: name, Phone: phone}
}

// ---- filterContacts ---------------------------------------------------------

func TestFilterContacts_MatchDisplayName(t *testing.T) {
	contacts := []db.Contact{
		makeContact(1, "Alice Smith", "1111"),
		makeContact(2, "Bob Jones", "2222"),
		makeContact(3, "alice wonder", "3333"),
	}
	got := filterContacts(contacts, "alice")
	assert.Len(t, got, 2)
	assert.Equal(t, int64(1), got[0].ID)
	assert.Equal(t, int64(3), got[1].ID)
}

func TestFilterContacts_MatchPhone(t *testing.T) {
	contacts := []db.Contact{
		makeContact(1, "A", "14155551234"),
		makeContact(2, "B", "9999999999"),
	}
	got := filterContacts(contacts, "415")
	assert.Len(t, got, 1)
	assert.Equal(t, int64(1), got[0].ID)
}

func TestFilterContacts_CaseInsensitiveDisplayName(t *testing.T) {
	contacts := []db.Contact{makeContact(1, "UPPER", "0")}
	assert.Len(t, filterContacts(contacts, "upper"), 1)
	assert.Len(t, filterContacts(contacts, "UPPER"), 1)
	assert.Len(t, filterContacts(contacts, "Upper"), 1)
}

func TestFilterContacts_NoMatch(t *testing.T) {
	contacts := []db.Contact{makeContact(1, "Alice", "1111")}
	assert.Empty(t, filterContacts(contacts, "xyz"))
}

func TestFilterContacts_EmptyQuery(t *testing.T) {
	contacts := []db.Contact{makeContact(1, "Alice", "1111")}
	// empty q would match everything (everything contains "")
	got := filterContacts(contacts, "")
	assert.Len(t, got, 1)
}

// ---- paginateContacts -------------------------------------------------------

func contacts5() []db.Contact {
	var cs []db.Contact
	for i := int64(1); i <= 5; i++ {
		cs = append(cs, makeContact(i, "", ""))
	}
	return cs
}

func TestPaginateContacts_FirstPage(t *testing.T) {
	got := paginateContacts(contacts5(), 0, 2)
	assert.Len(t, got, 2)
	assert.Equal(t, int64(1), got[0].ID)
	assert.Equal(t, int64(2), got[1].ID)
}

func TestPaginateContacts_SecondPage(t *testing.T) {
	got := paginateContacts(contacts5(), 2, 2)
	assert.Len(t, got, 2)
	assert.Equal(t, int64(3), got[0].ID)
}

func TestPaginateContacts_PartialLastPage(t *testing.T) {
	got := paginateContacts(contacts5(), 4, 10)
	assert.Len(t, got, 1)
	assert.Equal(t, int64(5), got[0].ID)
}

func TestPaginateContacts_OffsetBeyondLen(t *testing.T) {
	got := paginateContacts(contacts5(), 10, 3)
	assert.Empty(t, got)
}

func TestPaginateContacts_OffsetExactlyLen(t *testing.T) {
	got := paginateContacts(contacts5(), 5, 3)
	assert.Empty(t, got)
}
