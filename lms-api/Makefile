.PHONY: run build test vet tidy clean

run:
	go run main.go development

build:
	go build -o bin/lms-api main.go

test:
	go test -v ./...

vet:
	go vet ./...

tidy:
	go mod tidy

clean:
	rm -rf bin/
